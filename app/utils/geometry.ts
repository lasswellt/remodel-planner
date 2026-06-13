import type { Geometry } from '~/models'

// All floorplan math lives here, pure and unit-tested. World units are inches:
// the SVG viewBox is 1 unit = 1 inch, so geometry persists in real-world
// dimensions and sq ft falls out of w*h directly.
export const WORLD = { w: 720, h: 480 } as const // 60ft x 40ft per floor
export const DEFAULT_GRID_STEP = 6 // inches
export const GRID_STEPS = [3, 6, 12] as const
export const MIN_ROOM_SIZE = 12 // inches; a room can never collapse below this

export function snapTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

// Keep a rect fully inside the world, preserving size where possible.
export function clampToWorld(geo: Geometry): Geometry {
  const w = Math.min(geo.w, WORLD.w)
  const h = Math.min(geo.h, WORLD.h)
  const x = Math.min(Math.max(0, geo.x), WORLD.w - w)
  const y = Math.min(Math.max(0, geo.y), WORLD.h - h)
  return { ...geo, x, y, w, h }
}

// Normalized, snapped, min-sized rect between two free points — used for both
// the draw preview and corner-handle resizing (the anchor is just corner `a`).
// Corners are clamped into the world FIRST so dragging the pointer past an
// edge saturates the moving corner instead of translating the anchored one.
export function rectFromCorners(
  a: { x: number, y: number },
  b: { x: number, y: number },
  step: number,
  rotation = 0,
): Geometry {
  const cx = (v: number) => Math.min(Math.max(0, v), WORLD.w)
  const cy = (v: number) => Math.min(Math.max(0, v), WORLD.h)
  const min = Math.max(step, MIN_ROOM_SIZE)
  const x0 = snapTo(Math.min(cx(a.x), cx(b.x)), step)
  const y0 = snapTo(Math.min(cy(a.y), cy(b.y)), step)
  const x1 = snapTo(Math.max(cx(a.x), cx(b.x)), step)
  const y1 = snapTo(Math.max(cy(a.y), cy(b.y)), step)
  return clampToWorld({
    x: x0,
    y: y0,
    w: Math.max(min, x1 - x0),
    h: Math.max(min, y1 - y0),
    rotation,
    notches: [],
  })
}

export function moveTo(geo: Geometry, x: number, y: number, step: number): Geometry {
  return clampToWorld({ ...geo, x: snapTo(x, step), y: snapTo(y, step) })
}

export function nudge(geo: Geometry, dx: number, dy: number, step: number): Geometry {
  return clampToWorld({ ...geo, x: geo.x + dx * step, y: geo.y + dy * step })
}

// 90° rotation of an axis-aligned rect about its center is exactly a w/h swap;
// rects stay axis-aligned (no transform rendering needed) and the cumulative
// rotation is kept on the geometry for export/import fidelity. A rect whose
// long side would not fit the other world dimension stays unrotated — clamping
// it would silently and irreversibly shrink the room.
export function rotate90(geo: Geometry, step: number): Geometry {
  if (geo.h > WORLD.w || geo.w > WORLD.h) return geo
  const cx = geo.x + geo.w / 2
  const cy = geo.y + geo.h / 2
  return clampToWorld({
    ...geo,
    x: snapTo(cx - geo.h / 2, step),
    y: snapTo(cy - geo.w / 2, step),
    w: geo.h,
    h: geo.w,
    rotation: (geo.rotation + 90) % 360,
  })
}

// Notch-aware floor area: the outer rect minus the (clipped, possibly
// overlapping) notch cutouts. Falls back to w*h for a plain rect.
export function sqFt(geo: Geometry): number {
  return Math.round(areaSqIn(geo) / 144)
}

function inchesToFeetLabel(inches: number): string {
  const ft = Math.floor(inches / 12)
  const in_ = inches % 12
  return in_ === 0 ? `${ft}'` : `${ft}'${in_}"`
}

// e.g. 150" × 120" → "12'6\" × 10'"
export function dimsLabel(geo: Geometry): string {
  return `${inchesToFeetLabel(geo.w)} × ${inchesToFeetLabel(geo.h)}`
}

// Inches → decimal feet string for an input field (e.g. 150 → "12.5")
export function inchesToFeetInput(inches: number): string {
  const ft = inches / 12
  return Number.isInteger(ft) ? String(ft) : ft.toFixed(2).replace(/\.?0+$/, '')
}

// Parse a feet input (decimal or integer) → inches, snapped to step, clamped.
// Accepts "12", "10.5", "12.5" etc. Returns null for invalid input.
export function parseFeetToInches(
  value: string,
  step: number,
  max: number,
): number | null {
  const ft = parseFloat(value)
  if (!Number.isFinite(ft) || ft <= 0) return null
  const raw = ft * 12
  const snapped = Math.round(raw / step) * step
  return Math.min(Math.max(MIN_ROOM_SIZE, snapped), max)
}

export function sameRect(a: Geometry, b: Geometry): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
    && a.rotation === b.rotation
}

// SVG path for the room as its true rectilinear outline — the outer rect minus
// notch cutouts, traced as real polygon rings. A corner/edge notch yields a
// clean L/T/U outline (no stroke crossing the cut); an interior notch yields a
// hole (an inner ring), rendered via fill-rule="evenodd". Replaces the old
// rect-plus-hole path, which stroked the full outer rectangle through the cut.
export function buildRoomPath(geo: Geometry): string {
  return rectilinearRings(geo)
    .map(ring => `M ${ring.map(p => `${p.x} ${p.y}`).join(' L ')} Z`)
    .join(' ')
}

// ---- rectilinear region geometry (rect minus axis-aligned notch cutouts) ----

export interface Pt { x: number, y: number }
interface ClipRect { x0: number, y0: number, x1: number, y1: number }

// Notches in world coords, clipped to the room rect, empties dropped.
function clippedNotches(geo: Geometry): ClipRect[] {
  const rx1 = geo.x + geo.w
  const ry1 = geo.y + geo.h
  const out: ClipRect[] = []
  for (const n of geo.notches ?? []) {
    const x0 = Math.max(geo.x, geo.x + n.x)
    const y0 = Math.max(geo.y, geo.y + n.y)
    const x1 = Math.min(rx1, geo.x + n.x + n.w)
    const y1 = Math.min(ry1, geo.y + n.y + n.h)
    if (x1 > x0 && y1 > y0) out.push({ x0, y0, x1, y1 })
  }
  return out
}

// The grid induced by every rect/notch edge. Cells are uniform-inside, so the
// region is exactly described by which cells are "inside" (in rect, not in any
// notch) — robust to overlapping notches.
function inducedGrid(geo: Geometry) {
  const notches = clippedNotches(geo)
  const xs = [...new Set([geo.x, geo.x + geo.w, ...notches.flatMap(n => [n.x0, n.x1])])].sort((a, b) => a - b)
  const ys = [...new Set([geo.y, geo.y + geo.h, ...notches.flatMap(n => [n.y0, n.y1])])].sort((a, b) => a - b)
  const insideAt = (cx: number, cy: number): boolean => {
    if (cx <= geo.x || cx >= geo.x + geo.w || cy <= geo.y || cy >= geo.y + geo.h) return false
    for (const n of notches) if (cx > n.x0 && cx < n.x1 && cy > n.y0 && cy < n.y1) return false
    return true
  }
  return { xs, ys, insideAt }
}

function areaSqIn(geo: Geometry): number {
  const { xs, ys, insideAt } = inducedGrid(geo)
  let area = 0
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (insideAt((xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2)) {
        area += (xs[i + 1]! - xs[i]!) * (ys[j + 1]! - ys[j]!)
      }
    }
  }
  return area
}

function mergeCollinear(ring: Pt[]): Pt[] {
  const n = ring.length
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n]!
    const b = ring[i]!
    const c = ring[(i + 1) % n]!
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
    if (!collinear) out.push(b)
  }
  return out
}

// Boundary rings of the inside region. Each inside cell emits its outer-facing
// edges clockwise (screen y-down); shared edges between two inside cells are
// never emitted, so only the true boundary survives — stitched into rings.
// Outer ring winds CW, holes CCW (evenodd-friendly).
export function rectilinearRings(geo: Geometry): Pt[][] {
  const { xs, ys, insideAt } = inducedGrid(geo)
  const cols = xs.length - 1
  const rows = ys.length - 1
  const cell = (i: number, j: number): boolean =>
    i >= 0 && i < cols && j >= 0 && j < rows
    && insideAt((xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2)

  const k = (p: Pt) => `${p.x},${p.y}`
  const next = new Map<string, Pt>()
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (!cell(i, j)) continue
      const X0 = xs[i]!, X1 = xs[i + 1]!, Y0 = ys[j]!, Y1 = ys[j + 1]!
      if (!cell(i, j - 1)) next.set(k({ x: X0, y: Y0 }), { x: X1, y: Y0 }) // top →
      if (!cell(i + 1, j)) next.set(k({ x: X1, y: Y0 }), { x: X1, y: Y1 }) // right ↓
      if (!cell(i, j + 1)) next.set(k({ x: X1, y: Y1 }), { x: X0, y: Y1 }) // bottom ←
      if (!cell(i - 1, j)) next.set(k({ x: X0, y: Y1 }), { x: X0, y: Y0 }) // left ↑
    }
  }

  const rings: Pt[][] = []
  while (next.size > 0) {
    const startKey = next.keys().next().value as string
    let curKey = startKey
    const ring: Pt[] = []
    while (next.has(curKey)) {
      const [sx, sy] = curKey.split(',').map(Number) as [number, number]
      ring.push({ x: sx, y: sy })
      const to = next.get(curKey)!
      next.delete(curKey)
      curKey = k(to)
      if (curKey === startKey) break
    }
    if (ring.length >= 3) rings.push(mergeCollinear(ring))
  }
  return rings
}

// ---- room-to-room edge snapping ----

export const SNAP_TOL = 9 // inches; a dragged edge within this of a target snaps

export interface SnapTargets { xs: number[], ys: number[] }

// Vertical + horizontal edge lines from the OTHER rooms (their outer rect edges
// and their notch edges) — the lines a dragged room magnetizes its edges to so
// rooms tuck flush together and into notch corners.
export function edgeSnapTargets(
  rooms: { id: string, geometry: Geometry }[],
  excludeId: string | null,
): SnapTargets {
  const xs = new Set<number>()
  const ys = new Set<number>()
  for (const r of rooms) {
    if (r.id === excludeId) continue
    const g = r.geometry
    xs.add(g.x); xs.add(g.x + g.w)
    ys.add(g.y); ys.add(g.y + g.h)
    for (const n of g.notches ?? []) {
      xs.add(g.x + n.x); xs.add(g.x + n.x + n.w)
      ys.add(g.y + n.y); ys.add(g.y + n.y + n.h)
    }
  }
  return { xs: [...xs], ys: [...ys] }
}

// Nearest target within tol. Returns the (possibly snapped) value and the line
// it locked onto (null if none) — the caller draws a guide at `snapped`.
export function snapScalar(value: number, targets: number[], tol = SNAP_TOL): { value: number, snapped: number | null } {
  let best = value
  let bestDist = tol
  let snapped: number | null = null
  for (const t of targets) {
    const d = Math.abs(t - value)
    if (d < bestDist) {
      bestDist = d
      best = t
      snapped = t
    }
  }
  return { value: best, snapped }
}
