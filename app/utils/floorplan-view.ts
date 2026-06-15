import { WORLD } from './geometry'

// Pure pan/zoom math for the floorplan SVG viewBox. Kept out of useFloorplan so
// it is unit-testable (the composable wires these to refs + DOM pointer events).
// A ViewBox is the SVG viewBox in world units; shrinking w zooms in, shifting
// x/y pans. Aspect is locked to the world so the plan never distorts.

export interface ViewBox { x: number, y: number, w: number, h: number }

export const MAX_ZOOM = 4
export const MIN_VIEW_W = WORLD.w / MAX_ZOOM
const ASPECT = WORLD.h / WORLD.w

export const FULL_VIEW: ViewBox = { x: 0, y: 0, w: WORLD.w, h: WORLD.h }

// Clamp width to [MIN_VIEW_W, WORLD.w], lock height to the world aspect, and keep
// the box inside the world so you can never pan or zoom off the plan.
export function clampView(v: ViewBox): ViewBox {
  const w = Math.min(WORLD.w, Math.max(MIN_VIEW_W, v.w))
  const h = w * ASPECT
  return {
    x: Math.min(Math.max(0, v.x), WORLD.w - w),
    y: Math.min(Math.max(0, v.y), WORLD.h - h),
    w,
    h,
  }
}

// Zoom `cur` to a target width, keeping the world point `focal` fixed on screen
// (default focal = the current view centre). Returns a clamped ViewBox.
export function zoomView(cur: ViewBox, newW: number, focal?: { x: number, y: number }): ViewBox {
  const w = Math.min(WORLD.w, Math.max(MIN_VIEW_W, newW))
  const f = focal ?? { x: cur.x + cur.w / 2, y: cur.y + cur.h / 2 }
  const fx = (f.x - cur.x) / cur.w
  const fy = (f.y - cur.y) / cur.h
  return clampView({ x: f.x - fx * w, y: f.y - fy * (w * ASPECT), w, h: w * ASPECT })
}

// Two-finger pinch: from the gesture baseline (initial finger distance d0, the
// world focal point captured at gesture start, and the initial view width w0)
// plus the current finger screen positions and the SVG element rect, compute the
// new view — the focal world point tracks the live finger midpoint (pinch + pan).
export function pinchView(
  base: { d0: number, focal: { x: number, y: number }, w0: number },
  a: { x: number, y: number },
  b: { x: number, y: number },
  rect: { left: number, top: number, width: number, height: number },
): ViewBox {
  const d1 = Math.hypot(a.x - b.x, a.y - b.y)
  const w = Math.min(WORLD.w, Math.max(MIN_VIEW_W, base.w0 / (d1 / base.d0)))
  const h = w * ASPECT
  const nx = ((a.x + b.x) / 2 - rect.left) / rect.width
  const ny = ((a.y + b.y) / 2 - rect.top) / rect.height
  return clampView({ x: base.focal.x - nx * w, y: base.focal.y - ny * h, w, h })
}
