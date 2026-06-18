import { describe, expect, it } from 'vitest'
import { clampView, FIT_MARGIN, fitView, FULL_VIEW, labelScaleForWidth, LABEL_MIN_SCALE, MAX_ZOOM, MIN_VIEW_W, pinchView, zoomView } from '../app/utils/floorplan-view'

// WORLD is 1440×960; MIN_VIEW_W = 1440/6 = 240; aspect = 2/3. These assertions
// mirror the values verified against the live app.

const ASPECT = 2 / 3

describe('floorplan-view: constants', () => {
  it('full view is the whole world; min width is a 6× zoom', () => {
    expect(FULL_VIEW).toEqual({ x: 0, y: 0, w: 1440, h: 960 })
    expect(MIN_VIEW_W).toBe(240)
    expect(MAX_ZOOM).toBe(6)
  })
})

describe('floorplan-view: clampView', () => {
  it('clamps width into [MIN_VIEW_W, WORLD.w] and locks the world aspect', () => {
    expect(clampView({ x: 0, y: 0, w: 9999, h: 0 })).toEqual({ x: 0, y: 0, w: 1440, h: 960 })
    expect(clampView({ x: 0, y: 0, w: 10, h: 0 })).toEqual({ x: 0, y: 0, w: 240, h: 160 })
  })

  it('keeps the box inside the world (no panning off the plan)', () => {
    expect(clampView({ x: -50, y: -50, w: 360, h: 240 })).toEqual({ x: 0, y: 0, w: 360, h: 240 })
    expect(clampView({ x: 9999, y: 9999, w: 360, h: 240 })).toEqual({ x: 1080, y: 720, w: 360, h: 240 })
  })
})

describe('floorplan-view: zoomView', () => {
  it('zooms about the centre by default', () => {
    expect(zoomView(FULL_VIEW, 360)).toEqual({ x: 540, y: 360, w: 360, h: 240 })
  })

  it('clamps to max zoom (MIN_VIEW_W) and stays centred', () => {
    expect(zoomView(FULL_VIEW, 50)).toEqual({ x: 600, y: 400, w: 240, h: 160 })
  })

  it('keeps a non-centre focal point fixed on screen', () => {
    // focal at the world origin (top-left) → the box grows from the top-left
    expect(zoomView(FULL_VIEW, 360, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: 360, h: 240 })
  })

  it('zooming back out beyond full snaps to the whole world', () => {
    const zoomed = { x: 600, y: 400, w: 240, h: 160 }
    expect(zoomView(zoomed, 9999)).toEqual({ x: 0, y: 0, w: 1440, h: 960 })
  })

  it('is reversible: zoom in then back out returns to full', () => {
    const inOnce = zoomView(FULL_VIEW, 360)
    expect(zoomView(inOnce, 1440)).toEqual(FULL_VIEW)
  })
})

describe('floorplan-view: pinchView', () => {
  const rect = { left: 0, top: 0, width: 720, height: 480 }

  it('spreading fingers zooms in toward their midpoint', () => {
    const base = { d0: 200, focal: { x: 720, y: 480 }, w0: 1440 }
    // distance 400 (2× of d0) → width 1440/2 = 720; midpoint is the rect centre
    const v = pinchView(base, { x: 160, y: 240 }, { x: 560, y: 240 }, rect)
    expect(v).toEqual({ x: 360, y: 240, w: 720, h: 480 })
  })

  it('pinching fingers together zooms out (clamped to full world)', () => {
    const base = { d0: 200, focal: { x: 720, y: 480 }, w0: 720 }
    // distance 50 (0.25×) → width 720/0.25 = 2880 → clamped to 1440 (full)
    const v = pinchView(base, { x: 335, y: 240 }, { x: 385, y: 240 }, rect)
    expect(v).toEqual({ x: 0, y: 0, w: 1440, h: 960 })
  })
})

describe('floorplan-view: fitView', () => {
  const room = (x: number, y: number, w: number, h: number) =>
    ({ geometry: { x, y, w, h, rotation: 0, notches: [], walls: { n: 0, s: 0, e: 0, w: 0 }, basis: 'exterior' as const, openings: [], fixtures: [] } })

  it('frames an empty plan to the whole world', () => {
    expect(fitView([])).toEqual(FULL_VIEW)
  })

  it('frames a plan to its bounding box plus a margin, world-aspect, on the plan', () => {
    const v = fitView([room(600, 400, 240, 120), room(840, 400, 120, 120)])
    // box spans x 600..960, y 400..520; padded by FIT_MARGIN on all sides
    expect(v.w / v.h).toBeCloseTo(1 / ASPECT, 6) // locked to the world aspect
    expect(v.w).toBeGreaterThanOrEqual(MIN_VIEW_W)
    expect(v.w).toBeLessThanOrEqual(1440)
    // contains the padded bounding box
    expect(v.x).toBeLessThanOrEqual(600 - FIT_MARGIN)
    expect(v.y).toBeLessThanOrEqual(400 - FIT_MARGIN)
    expect(v.x + v.w).toBeGreaterThanOrEqual(960 + FIT_MARGIN)
    expect(v.y + v.h).toBeGreaterThanOrEqual(520 + FIT_MARGIN)
    // stays on the plan
    expect(v.x).toBeGreaterThanOrEqual(0)
    expect(v.y).toBeGreaterThanOrEqual(0)
    expect(clampView(v)).toEqual(v)
  })

  it('frames a tiny room at max zoom (MIN_VIEW_W) without over-zooming', () => {
    expect(fitView([room(700, 460, 24, 24)]).w).toBe(MIN_VIEW_W)
  })
})

describe('floorplan-view: labelScaleForWidth', () => {
  it('is 1 at the full world and halves at half width', () => {
    expect(labelScaleForWidth(1440)).toBe(1)
    expect(labelScaleForWidth(720)).toBe(0.5)
  })

  it('floors at LABEL_MIN_SCALE when zoomed in past it', () => {
    // 240/1440 = 0.167 < 0.3 → floored
    expect(labelScaleForWidth(MIN_VIEW_W)).toBe(LABEL_MIN_SCALE)
    expect(labelScaleForWidth(0)).toBe(LABEL_MIN_SCALE)
  })

  it('never exceeds 1 even if the view somehow exceeds the world', () => {
    expect(labelScaleForWidth(99999)).toBe(1)
  })
})
