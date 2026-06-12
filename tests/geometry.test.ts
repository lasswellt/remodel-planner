import { describe, expect, it } from 'vitest'
import {
  clampToWorld,
  MIN_ROOM_SIZE,
  moveTo,
  nudge,
  rectFromCorners,
  rotate90,
  sameRect,
  snapTo,
  sqFt,
  WORLD,
} from '../app/utils/geometry'

describe('snapTo', () => {
  it('snaps to the nearest multiple of the step', () => {
    expect(snapTo(0, 6)).toBe(0)
    expect(snapTo(2, 6)).toBe(0)
    expect(snapTo(3, 6)).toBe(6)
    expect(snapTo(7, 6)).toBe(6)
    expect(snapTo(10, 6)).toBe(12)
    expect(snapTo(10, 3)).toBe(9)
  })
})

describe('rectFromCorners', () => {
  it('normalizes corners drawn in any direction', () => {
    const down = rectFromCorners({ x: 0, y: 0 }, { x: 60, y: 48 }, 6)
    const up = rectFromCorners({ x: 60, y: 48 }, { x: 0, y: 0 }, 6)
    expect(down).toEqual(up)
    expect(down).toMatchObject({ x: 0, y: 0, w: 60, h: 48 })
  })

  it('snaps both corners to the grid', () => {
    const rect = rectFromCorners({ x: 2, y: 4 }, { x: 61, y: 47 }, 6)
    expect(rect).toMatchObject({ x: 0, y: 6, w: 60, h: 42 })
  })

  it('enforces the minimum room size', () => {
    const rect = rectFromCorners({ x: 0, y: 0 }, { x: 2, y: 2 }, 6)
    expect(rect.w).toBe(MIN_ROOM_SIZE)
    expect(rect.h).toBe(MIN_ROOM_SIZE)
  })

  it('preserves the rotation passed through', () => {
    expect(rectFromCorners({ x: 0, y: 0 }, { x: 60, y: 60 }, 6, 90).rotation).toBe(90)
  })

  it('saturates the moving corner at the world edge without sliding the anchor', () => {
    // Resize anchored at x=600, pointer dragged 300in past the right edge:
    // the anchored corner must stay at 600.
    const rect = rectFromCorners({ x: 600, y: 0 }, { x: WORLD.w + 300, y: 48 }, 6)
    expect(rect.x).toBe(600)
    expect(rect.x + rect.w).toBe(WORLD.w)
  })
})

describe('clampToWorld / moveTo / nudge', () => {
  it('keeps rects inside the world', () => {
    const g = { x: -20, y: -20, w: 120, h: 96, rotation: 0 }
    expect(clampToWorld(g)).toMatchObject({ x: 0, y: 0 })
    const far = clampToWorld({ ...g, x: WORLD.w + 50, y: WORLD.h + 50 })
    expect(far.x).toBe(WORLD.w - 120)
    expect(far.y).toBe(WORLD.h - 96)
  })

  it('moveTo snaps and clamps', () => {
    const g = { x: 0, y: 0, w: 120, h: 96, rotation: 0 }
    expect(moveTo(g, 7, 8, 6)).toMatchObject({ x: 6, y: 6 })
    expect(moveTo(g, 99999, 0, 6).x).toBe(WORLD.w - 120)
  })

  it('nudge moves one grid step per press and stops at the wall', () => {
    const g = { x: 0, y: 0, w: 120, h: 96, rotation: 0 }
    expect(nudge(g, 1, 0, 6).x).toBe(6)
    expect(nudge(g, -1, 0, 6).x).toBe(0)
    expect(nudge(g, 0, -1, 6).y).toBe(0)
  })
})

describe('rotate90', () => {
  it('swaps width and height around the center', () => {
    const g = { x: 60, y: 60, w: 120, h: 60, rotation: 0 }
    const r = rotate90(g, 6)
    expect(r.w).toBe(60)
    expect(r.h).toBe(120)
    // Center is preserved (up to grid snap).
    expect(r.x + r.w / 2).toBeCloseTo(g.x + g.w / 2, 0)
    expect(r.y + r.h / 2).toBeCloseTo(g.y + g.h / 2, 0)
  })

  it('accumulates rotation in 90° steps and wraps at 360', () => {
    let g = { x: 0, y: 0, w: 120, h: 60, rotation: 0 }
    g = rotate90(g, 6)
    expect(g.rotation).toBe(90)
    g = rotate90(g, 6)
    g = rotate90(g, 6)
    g = rotate90(g, 6)
    expect(g.rotation).toBe(0)
    expect(g.w).toBe(120)
    expect(g.h).toBe(60)
  })

  it('stays inside the world when rotated against an edge', () => {
    const g = { x: WORLD.w - 60, y: 0, w: 60, h: 240, rotation: 0 }
    const r = rotate90(g, 6)
    expect(r.x + r.w).toBeLessThanOrEqual(WORLD.w)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
  })

  it('is a no-op when the rotated rect cannot fit the world (no silent truncation)', () => {
    const wide = { x: 0, y: 0, w: 600, h: 60, rotation: 0 } // 600 > WORLD.h (480)
    expect(rotate90(wide, 6)).toEqual(wide)
  })
})

describe('sqFt', () => {
  it('converts square inches to square feet', () => {
    expect(sqFt({ x: 0, y: 0, w: 12, h: 12, rotation: 0 })).toBe(1)
    expect(sqFt({ x: 0, y: 0, w: 120, h: 144, rotation: 0 })).toBe(120)
    expect(sqFt({ x: 0, y: 0, w: 126, h: 126, rotation: 0 })).toBe(110) // rounds
  })
})

describe('sameRect', () => {
  it('compares all geometry fields', () => {
    const g = { x: 0, y: 0, w: 60, h: 60, rotation: 0 }
    expect(sameRect(g, { ...g })).toBe(true)
    expect(sameRect(g, { ...g, rotation: 90 })).toBe(false)
    expect(sameRect(g, { ...g, x: 6 })).toBe(false)
  })
})
