import type { Fixture, Geometry, Opening, WallSide } from '~/models'

// All floorplan math lives here, pure and unit-tested. World units are inches:
// the SVG viewBox is 1 unit = 1 inch, so geometry persists in real-world
// dimensions and sq ft falls out of w*h directly.
export const WORLD = { w: 720, h: 480 } as const // 60ft x 40ft per floor
export const DEFAULT_GRID_STEP = 6 // inches
export const GRID_STEPS = [3, 6, 12] as const
export const MIN_ROOM_SIZE = 12 // inches; a room can never collapse below this
export const MIN_FIXTURE_SIZE = 6 // inches; smallest placeable fixture edge
const MIN_OPENING_BAND = 5 // inches; legible opening marker on a wall-less edge

const NO_WALLS = { n: 0, s: 0, e: 0, w: 0 } as const

// A bare exterior-basis Geometry with no walls/notches/openings/fixtures —
// the canonical constructor so every code path includes the schema's fields.
export function emptyGeometry(rect: {
  x: number
  y: number
  w: number
  h: number
  rotation?: number
}): Geometry {
  return {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    rotation: rect.rotation ?? 0,
    notches: [],
    walls: { ...NO_WALLS },
    basis: 'exterior',
    openings: [],
    fixtures: [],
  }
}

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
  return clampToWorld(emptyGeometry({
    x: x0,
    y: y0,
    w: Math.max(min, x1 - x0),
    h: Math.max(min, y1 - y0),
    rotation,
  }))
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
  const oldH = geo.h
  // Walls, notches, openings and fixtures rotate rigidly with the footprint so
  // a door stays on its physical wall and a tub keeps its corner. Field access
  // is defensive: in-flight / legacy objects may predate these fields.
  const walls = geo.walls ?? NO_WALLS
  return clampToWorld({
    ...geo,
    x: snapTo(cx - geo.h / 2, step),
    y: snapTo(cy - geo.w / 2, step),
    w: geo.h,
    h: geo.w,
    rotation: (geo.rotation + 90) % 360,
    walls: { n: walls.w, e: walls.n, s: walls.e, w: walls.s },
    notches: (geo.notches ?? []).map(n => ({
      ...n,
      x: oldH - (n.y + n.h),
      y: n.x,
      w: n.h,
      h: n.w,
    })),
    openings: (geo.openings ?? []).map(op => rotateOpeningCW(op, oldH)),
    // Map the fixture's CENTER under the CW rotation and bump its rotation; keep
    // stored w/h as-is — fixtureWorldRect() does the w/h swap from the rotation,
    // so swapping the stored values here too would cancel and leave it unrotated.
    fixtures: (geo.fixtures ?? []).map((f) => {
      const ncx = oldH - (f.y + f.h / 2) // CW: (lx,ly) → (oldH − ly, lx)
      const ncy = f.x + f.w / 2
      return { ...f, x: ncx - f.w / 2, y: ncy - f.h / 2, rotation: ((f.rotation ?? 0) + 90) % 360 }
    }),
  })
}

// Opening remap under a 90° clockwise footprint rotation. n→e and s→w preserve
// the along-wall offset; e→s and w→n reverse it (newW = oldH), and a reversed
// direction flips the hinge so the leaf keeps swinging the same physical way.
function rotateOpeningCW(op: Opening, oldH: number): Opening {
  const newW = oldH
  const flip = (h?: 'left' | 'right') =>
    h === 'left' ? 'right' : h === 'right' ? 'left' : h
  switch (op.wall) {
    case 'n': return { ...op, wall: 'e', offset: op.offset }
    case 'e': return { ...op, wall: 's', offset: newW - (op.offset + op.width), hinge: flip(op.hinge) }
    case 's': return { ...op, wall: 'w', offset: op.offset }
    case 'w': return { ...op, wall: 'n', offset: newW - (op.offset + op.width), hinge: flip(op.hinge) }
  }
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

// e.g. 150 × 120 → "12'6\" × 10'"
export function dimsLabelWH(w: number, h: number): string {
  return `${inchesToFeetLabel(w)} × ${inchesToFeetLabel(h)}`
}

// Single length in feet-inches, e.g. 30 → "2'6\"".
export function lengthLabel(inches: number): string {
  return inchesToFeetLabel(inches)
}

// e.g. 150" × 120" → "12'6\" × 10'" (the footprint / exterior dimensions)
export function dimsLabel(geo: Geometry): string {
  return dimsLabelWH(geo.w, geo.h)
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

// ---- non-destructive overlap auto-cut (stacking order) ----

export interface Rect { x: number, y: number, w: number, h: number }

export function footprintRect(geo: Geometry): Rect {
  return { x: geo.x, y: geo.y, w: geo.w, h: geo.h }
}

// Overlap of two world rects, or null if they don't intersect (touching edges
// don't count — a flush-tucked room cuts nothing).
function rectIntersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export interface StackRoom { id: string, z?: number, geometry: Geometry }

// Precedence: a room with higher z (ties broken by later position in `all`) sits
// on top. `effectiveGeometry` folds every higher room's overlap into THIS room
// as extra notches (relative coords), so its path/area/labels recompute live as
// rooms are dragged — and restore the instant the cover moves away. `all` must
// be the rooms on the same floor (different floors never interact).
export function effectiveGeometry(room: StackRoom, all: StackRoom[]): Geometry {
  const i = all.findIndex(r => r.id === room.id)
  const rz = room.z ?? 0
  const fr = footprintRect(room.geometry)
  const cuts = []
  for (let j = 0; j < all.length; j++) {
    const o = all[j]!
    if (o.id === room.id) continue
    const oz = o.z ?? 0
    const higher = oz > rz || (oz === rz && j > i)
    if (!higher) continue
    const inter = rectIntersect(fr, footprintRect(o.geometry))
    if (inter) {
      cuts.push({ id: `ov:${o.id}`, x: inter.x - room.geometry.x, y: inter.y - room.geometry.y, w: inter.w, h: inter.h })
    }
  }
  if (cuts.length === 0) return room.geometry
  return { ...room.geometry, notches: [...(room.geometry.notches ?? []), ...cuts] }
}

// ---- walls / interior ----

export function hasWalls(geo: Geometry): boolean {
  const w = geo.walls ?? NO_WALLS
  return w.n > 0 || w.s > 0 || w.e > 0 || w.w > 0
}

// The usable interior rect: the footprint inset by each wall's thickness.
export function interiorRect(geo: Geometry): Rect {
  const wl = geo.walls ?? NO_WALLS
  return {
    x: geo.x + wl.w,
    y: geo.y + wl.n,
    w: Math.max(0, geo.w - wl.w - wl.e),
    h: Math.max(0, geo.h - wl.n - wl.s),
  }
}

export function interiorWH(geo: Geometry): { w: number, h: number } {
  const wl = geo.walls ?? NO_WALLS
  return { w: Math.max(0, geo.w - wl.w - wl.e), h: Math.max(0, geo.h - wl.n - wl.s) }
}

// Geometry of the usable interior region (outer = interior rect, cuts re-based
// to the interior origin). sqFt() of this is the finished floor area.
export function interiorGeometry(geo: Geometry): Geometry {
  if (!hasWalls(geo)) return geo
  const ir = interiorRect(geo)
  const wl = geo.walls ?? NO_WALLS
  return {
    ...geo,
    x: ir.x,
    y: ir.y,
    w: ir.w,
    h: ir.h,
    walls: { ...NO_WALLS },
    notches: (geo.notches ?? []).map(n => ({ ...n, x: n.x - wl.w, y: n.y - wl.n })),
  }
}

// Usable (interior) floor area in sq ft; equals gross sqFt() when there are no
// walls. Pass an already-effective geometry to account for overlap cuts too.
export function usableSqFt(geo: Geometry): number {
  return sqFt(interiorGeometry(geo))
}

// ---- wall bands & segments ----

interface WallAxis {
  ax: number, ay: number // start corner (offset 0)
  dx: number, dy: number // unit direction along the wall
  nx: number, ny: number // unit normal pointing into the interior
  length: number
  thickness: number
}

// The wall as an axis: start corner, along-wall direction, interior normal.
export function wallAxis(geo: Geometry, side: WallSide): WallAxis {
  const wl = geo.walls ?? NO_WALLS
  const { x, y, w, h } = geo
  switch (side) {
    case 'n': return { ax: x, ay: y, dx: 1, dy: 0, nx: 0, ny: 1, length: w, thickness: wl.n }
    case 's': return { ax: x, ay: y + h, dx: 1, dy: 0, nx: 0, ny: -1, length: w, thickness: wl.s }
    case 'w': return { ax: x, ay: y, dx: 0, dy: 1, nx: 1, ny: 0, length: h, thickness: wl.w }
    case 'e': return { ax: x + w, ay: y, dx: 0, dy: 1, nx: -1, ny: 0, length: h, thickness: wl.e }
  }
}

// The solid wall band for one side as a world rect (thickness inward), or null
// if that wall has no thickness. Corners belong to both adjoining bands (solid).
export function wallBand(geo: Geometry, side: WallSide): Rect | null {
  const wl = geo.walls ?? NO_WALLS
  const { x, y, w, h } = geo
  switch (side) {
    case 'n': return wl.n > 0 ? { x, y, w, h: wl.n } : null
    case 's': return wl.s > 0 ? { x, y: y + h - wl.s, w, h: wl.s } : null
    case 'w': return wl.w > 0 ? { x, y, w: wl.w, h } : null
    case 'e': return wl.e > 0 ? { x: x + w - wl.e, y, w: wl.e, h } : null
  }
}

export const WALL_SIDES: WallSide[] = ['n', 's', 'e', 'w']

// The gap an opening punches across its wall's thickness (world coords). When
// the wall has no thickness the band collapses to the footprint edge line, so a
// minimum visual band keeps the marker legible.
export function openingGapRect(geo: Geometry, op: Opening): Rect {
  const ax = wallAxis(geo, op.wall)
  const t = Math.max(ax.thickness, MIN_OPENING_BAND)
  // jamb-to-jamb extent along the wall
  const sx = ax.ax + ax.dx * op.offset
  const sy = ax.ay + ax.dy * op.offset
  if (ax.dx !== 0) {
    // horizontal wall (n/s): band thickness runs in y toward the interior
    const y = ax.ny > 0 ? ax.ay : ax.ay - t
    return { x: sx, y, w: op.width, h: t }
  }
  // vertical wall (w/e)
  const x = ax.nx > 0 ? ax.ax : ax.ax - t
  return { x, y: sy, w: t, h: op.width }
}

// Each wall band split by the openings on it → the drawable solid pieces.
export function wallSegments(geo: Geometry): Rect[] {
  const out: Rect[] = []
  const openings = geo.openings ?? []
  for (const side of WALL_SIDES) {
    const band = wallBand(geo, side)
    if (!band) continue
    const horizontal = side === 'n' || side === 's'
    // opening intervals along the wall axis (x for n/s, y for w/e)
    const ax = wallAxis(geo, side)
    const gaps = openings
      .filter(op => op.wall === side)
      .map(op => [ax.dx !== 0 ? ax.ax + op.offset : ax.ay + op.offset, op.width] as [number, number])
      .map(([start, len]) => [start, start + len] as [number, number])
      .sort((a, b) => a[0] - b[0])
    // subtract gaps from the band's run
    const runStart = horizontal ? band.x : band.y
    const runEnd = horizontal ? band.x + band.w : band.y + band.h
    let cursor = runStart
    for (const [g0, g1] of gaps) {
      const c0 = Math.max(runStart, g0)
      const c1 = Math.min(runEnd, g1)
      if (c1 <= cursor) continue
      if (c0 > cursor) {
        out.push(horizontal
          ? { x: cursor, y: band.y, w: c0 - cursor, h: band.h }
          : { x: band.x, y: cursor, w: band.w, h: c0 - cursor })
      }
      cursor = Math.max(cursor, c1)
    }
    if (cursor < runEnd) {
      out.push(horizontal
        ? { x: cursor, y: band.y, w: runEnd - cursor, h: band.h }
        : { x: band.x, y: cursor, w: band.w, h: runEnd - cursor })
    }
  }
  return out
}

// ---- opening placement hit-test ----

// For a world point near a room edge, which wall it lands on and the snapped
// offset for a new opening of `width` (kept fully on the wall). null if the
// point isn't close enough to any edge.
export function openingHitTest(
  geo: Geometry,
  pt: { x: number, y: number },
  width: number,
  step: number,
  tol = 14,
): { wall: WallSide, offset: number } | null {
  const { x, y, w, h } = geo
  const within = pt.x >= x - tol && pt.x <= x + w + tol && pt.y >= y - tol && pt.y <= y + h + tol
  if (!within) return null
  const dists: { side: WallSide, d: number, along: number, length: number }[] = [
    { side: 'n', d: Math.abs(pt.y - y), along: pt.x - x, length: w },
    { side: 's', d: Math.abs(pt.y - (y + h)), along: pt.x - x, length: w },
    { side: 'w', d: Math.abs(pt.x - x), along: pt.y - y, length: h },
    { side: 'e', d: Math.abs(pt.x - (x + w)), along: pt.y - y, length: h },
  ]
  const best = dists.filter(c => c.d <= tol).sort((a, b) => a.d - b.d)[0]
  if (!best) return null
  // center the opening on the click, snap, keep it fully on the wall
  let offset = snapTo(best.along - width / 2, step)
  offset = Math.min(Math.max(0, offset), Math.max(0, best.length - width))
  return { wall: best.side, offset }
}

// ---- door symbol geometry ----

export interface DoorGeometry {
  hinge: Pt
  open: Pt // leaf tip in the open position
  latch: Pt // closed-leaf tip (on the wall, at the far jamb)
  sweep: 0 | 1 // SVG arc sweep flag from `open` → `latch`
  radius: number
}

// Hinge point, open-leaf tip and swing arc for a single door leaf. `whole` door
// uses the full width; callers split a double door into two half-width leaves.
export function doorGeometry(geo: Geometry, op: Opening, range?: { offset: number, width: number }): DoorGeometry {
  const ax = wallAxis(geo, op.wall)
  const offset = range?.offset ?? op.offset
  const width = range?.width ?? op.width
  // hinge on the start jamb (offset) for 'left', far jamb for 'right'
  const left = (op.hinge ?? 'left') === 'left'
  const hOff = left ? offset : offset + width
  const lOff = left ? offset + width : offset
  // anchor on the interior face for an inward swing, exterior face for outward
  const swingIn = (op.swing ?? 'in') === 'in'
  const t = Math.max(ax.thickness, 0)
  const faceShift = swingIn ? t : 0 // interior face is `thickness` in from outer edge
  const hinge = {
    x: ax.ax + ax.dx * hOff + ax.nx * faceShift,
    y: ax.ay + ax.dy * hOff + ax.ny * faceShift,
  }
  const latch = {
    x: ax.ax + ax.dx * lOff + ax.nx * faceShift,
    y: ax.ay + ax.dy * lOff + ax.ny * faceShift,
  }
  // perpendicular into the swing direction
  const px = swingIn ? ax.nx : -ax.nx
  const py = swingIn ? ax.ny : -ax.ny
  const open = { x: hinge.x + px * width, y: hinge.y + py * width }
  // sweep flag: sign of the cross product (open−hinge) × (latch−hinge)
  const cross = (open.x - hinge.x) * (latch.y - hinge.y) - (open.y - hinge.y) * (latch.x - hinge.x)
  return { hinge, open, latch, sweep: cross > 0 ? 1 : 0, radius: width }
}

// World rect covering an opening for pointer hit-testing / selection: jamb-to-
// jamb along the wall × a grab band biased toward the interior (a small lip
// outside the wall, the rest inside) so it's easy to grab without spilling
// outside the plan.
export function openingHitRect(geo: Geometry, op: Opening): Rect {
  const ax = wallAxis(geo, op.wall)
  const lip = 4
  const band = Math.max(ax.thickness, 0) + 22
  const sx = ax.ax + ax.dx * op.offset
  const sy = ax.ay + ax.dy * op.offset
  if (ax.dx !== 0) {
    const y = ax.ny > 0 ? ax.ay - lip : ax.ay - band + lip
    return { x: sx, y, w: op.width, h: band }
  }
  const x = ax.nx > 0 ? ax.ax - lip : ax.ax - band + lip
  return { x, y: sy, w: band, h: op.width }
}

// Project a world point onto an opening's wall → the snapped, clamped offset that
// keeps the opening fully on the wall. Used to drag an opening along its wall.
export function openingOffsetAt(geo: Geometry, op: Opening, pt: { x: number, y: number }, step: number, grabAlong = 0): number {
  const ax = wallAxis(geo, op.wall)
  const along = ax.dx !== 0 ? pt.x - ax.ax : pt.y - ax.ay
  const offset = snapTo(along - grabAlong, step)
  return Math.min(Math.max(0, offset), Math.max(0, ax.length - op.width))
}

// Dimension labels for the gaps between an opening and its wall's two corners
// (in feet-inches), positioned along the wall and inset toward the interior.
export function openingMeasures(geo: Geometry, op: Opening): { x: number, y: number, text: string }[] {
  const ax = wallAxis(geo, op.wall)
  const before = op.offset
  const after = ax.length - op.offset - op.width
  const inset = Math.max(ax.thickness, 0) + 12
  const mk = (start: number, len: number) => {
    const mid = start + len / 2
    return {
      x: ax.ax + ax.dx * mid + ax.nx * inset,
      y: ax.ay + ax.dy * mid + ax.ny * inset,
      text: lengthLabel(Math.round(len)),
    }
  }
  const out: { x: number, y: number, text: string }[] = []
  if (before > 0.5) out.push(mk(0, before))
  out.push(mk(op.offset, op.width)) // the opening's own width
  if (after > 0.5) out.push(mk(op.offset + op.width, after))
  return out
}

// Every segment of the room's actual outline, dimensioned. Walks the effective
// rectilinear polygon (footprint minus notches + overlap cuts) and emits a length
// label just outside each edge — so every wall run, every notch jog, and every
// place a neighbouring room cuts in gets its own measurement. The outer ring winds
// clockwise in screen space (y-down), so the outward normal of a directed edge is
// (dy, -dx).
export function outlineMeasures(geo: Geometry): { x: number, y: number, text: string }[] {
  const out: { x: number, y: number, text: string }[] = []
  const offset = 11
  for (const ring of rectilinearRings(geo)) {
    const n = ring.length
    for (let i = 0; i < n; i++) {
      const a = ring[i]!
      const b = ring[(i + 1) % n]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.abs(dx) + Math.abs(dy) // axis-aligned: one of dx/dy is 0
      if (len < 4) continue // skip slivers
      out.push({
        x: (a.x + b.x) / 2 + (dy / len) * offset,
        y: (a.y + b.y) / 2 + (-dx / len) * offset,
        text: lengthLabel(Math.round(len)),
      })
    }
  }
  return out
}

// Clearances from a fixture to its room walls — the gap to the nearest wall on
// each axis, positioned in that gap. Helps place fixtures precisely.
export function fixtureClearances(geo: Geometry, f: Fixture): { x: number, y: number, text: string }[] {
  const r = fixtureWorldRect(geo, f)
  const left = r.x - geo.x
  const right = geo.x + geo.w - (r.x + r.w)
  const top = r.y - geo.y
  const bottom = geo.y + geo.h - (r.y + r.h)
  const out: { x: number, y: number, text: string }[] = []
  const h = left <= right ? { len: left, a: geo.x, b: r.x } : { len: right, a: r.x + r.w, b: geo.x + geo.w }
  if (h.len > 3) out.push({ x: (h.a + h.b) / 2, y: r.y + r.h / 2, text: lengthLabel(Math.round(h.len)) })
  const v = top <= bottom ? { len: top, a: geo.y, b: r.y } : { len: bottom, a: r.y + r.h, b: geo.y + geo.h }
  if (v.len > 3) out.push({ x: r.x + r.w / 2, y: (v.a + v.b) / 2, text: lengthLabel(Math.round(v.len)) })
  return out
}

// ---- fixtures ----

// World rect of a fixture, honoring its 0/90/180/270 rotation about its center.
export function fixtureWorldRect(geo: Geometry, f: Fixture): Rect {
  const cx = geo.x + f.x + f.w / 2
  const cy = geo.y + f.y + f.h / 2
  const rot = (((f.rotation ?? 0) % 360) + 360) % 360
  const [w, h] = rot === 90 || rot === 270 ? [f.h, f.w] : [f.w, f.h]
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

// Keep a fixture's (x, y) so its rotated footprint stays inside the room.
export function clampFixtureToRoom(geo: Geometry, f: Fixture): { x: number, y: number } {
  const r = fixtureWorldRect(geo, f) // current rotated extent in world coords
  const relX = r.x - geo.x // top-left of rotated extent, relative to room
  const relY = r.y - geo.y
  const maxX = Math.max(0, geo.w - r.w)
  const maxY = Math.max(0, geo.h - r.h)
  const clampedRelX = Math.min(Math.max(0, relX), maxX)
  const clampedRelY = Math.min(Math.max(0, relY), maxY)
  // shift the stored (unrotated) origin by the same delta the rotated box moved
  return { x: f.x + (clampedRelX - relX), y: f.y + (clampedRelY - relY) }
}

export function moveFixtureTo(geo: Geometry, f: Fixture, relX: number, relY: number, step: number): Fixture {
  const moved = { ...f, x: snapTo(relX, step), y: snapTo(relY, step) }
  return { ...moved, ...clampFixtureToRoom(geo, moved) }
}

export function rotateFixture90(f: Fixture): Fixture {
  return { ...f, rotation: (((f.rotation ?? 0) + 90) % 360) }
}

// ---- dimension basis ----

// The W/H to show & edit for the geometry's current basis (interior subtracts
// the side walls; exterior is the raw footprint).
export function basisWH(geo: Geometry): { w: number, h: number } {
  return (geo.basis ?? 'exterior') === 'interior' ? interiorWH(geo) : { w: geo.w, h: geo.h }
}

// Convert basis-space W/H the user entered into the stored exterior footprint.
export function footprintFromBasis(geo: Geometry, w: number, h: number): { w: number, h: number } {
  if ((geo.basis ?? 'exterior') === 'interior') {
    const wl = geo.walls ?? NO_WALLS
    return { w: w + wl.w + wl.e, h: h + wl.n + wl.s }
  }
  return { w, h }
}
