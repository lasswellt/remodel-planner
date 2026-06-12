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
    x: snapTo(cx - geo.h / 2, step),
    y: snapTo(cy - geo.w / 2, step),
    w: geo.h,
    h: geo.w,
    rotation: (geo.rotation + 90) % 360,
  })
}

export function sqFt(geo: Geometry): number {
  return Math.round((geo.w * geo.h) / 144)
}

export function sameRect(a: Geometry, b: Geometry): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
    && a.rotation === b.rotation
}
