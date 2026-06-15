import { describe, expect, it } from 'vitest'
import { clampView, FULL_VIEW, MAX_ZOOM, MIN_VIEW_W, pinchView, zoomView } from '../app/utils/floorplan-view'

// WORLD is 720×480; MIN_VIEW_W = 720/4 = 180; aspect = 2/3. These assertions
// mirror the values verified against the live app (e.g. a 2-finger spread to max
// zoom lands the viewBox at "270 180 180 120").

describe('floorplan-view: constants', () => {
  it('full view is the whole world; min width is a 4× zoom', () => {
    expect(FULL_VIEW).toEqual({ x: 0, y: 0, w: 720, h: 480 })
    expect(MIN_VIEW_W).toBe(180)
    expect(MAX_ZOOM).toBe(4)
  })
})

describe('floorplan-view: clampView', () => {
  it('clamps width into [MIN_VIEW_W, WORLD.w] and locks the world aspect', () => {
    expect(clampView({ x: 0, y: 0, w: 9999, h: 0 })).toEqual({ x: 0, y: 0, w: 720, h: 480 })
    expect(clampView({ x: 0, y: 0, w: 10, h: 0 })).toEqual({ x: 0, y: 0, w: 180, h: 120 })
  })

  it('keeps the box inside the world (no panning off the plan)', () => {
    expect(clampView({ x: -50, y: -50, w: 360, h: 240 })).toEqual({ x: 0, y: 0, w: 360, h: 240 })
    expect(clampView({ x: 9999, y: 9999, w: 360, h: 240 })).toEqual({ x: 360, y: 240, w: 360, h: 240 })
  })
})

describe('floorplan-view: zoomView', () => {
  it('zooms about the centre by default', () => {
    expect(zoomView(FULL_VIEW, 360)).toEqual({ x: 180, y: 120, w: 360, h: 240 })
  })

  it('clamps to max zoom (MIN_VIEW_W) and stays centred', () => {
    expect(zoomView(FULL_VIEW, 50)).toEqual({ x: 270, y: 180, w: 180, h: 120 })
  })

  it('keeps a non-centre focal point fixed on screen', () => {
    // focal at the world origin (top-left) → the box grows from the top-left
    expect(zoomView(FULL_VIEW, 360, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: 360, h: 240 })
  })

  it('zooming back out beyond full snaps to the whole world', () => {
    const zoomed = { x: 270, y: 180, w: 180, h: 120 }
    expect(zoomView(zoomed, 9999)).toEqual({ x: 0, y: 0, w: 720, h: 480 })
  })

  it('is reversible: zoom in then back out returns to full', () => {
    const inOnce = zoomView(FULL_VIEW, 360)
    expect(zoomView(inOnce, 720)).toEqual(FULL_VIEW)
  })
})

describe('floorplan-view: pinchView', () => {
  const rect = { left: 0, top: 0, width: 360, height: 240 }

  it('spreading fingers zooms in toward their midpoint', () => {
    const base = { d0: 100, focal: { x: 360, y: 240 }, w0: 720 }
    // distance 200 (2× of d0) → width 720/2 = 360; midpoint is the rect centre
    const v = pinchView(base, { x: 80, y: 120 }, { x: 280, y: 120 }, rect)
    expect(v).toEqual({ x: 180, y: 120, w: 360, h: 240 })
  })

  it('pinching fingers together zooms out (clamped to full world)', () => {
    const base = { d0: 200, focal: { x: 360, y: 240 }, w0: 360 }
    // distance 50 (0.25×) → width 360/0.25 = 1440 → clamped to 720 (full)
    const v = pinchView(base, { x: 155, y: 120 }, { x: 205, y: 120 }, rect)
    expect(v).toEqual({ x: 0, y: 0, w: 720, h: 480 })
  })
})
