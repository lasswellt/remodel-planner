import { describe, expect, it } from 'vitest'
import type { Fixture, Geometry, Notch, Opening } from '../app/models'
import {
  basisWH,
  clampToWorld,
  doorGeometry,
  edgeSnapTargets,
  effectiveGeometry,
  emptyGeometry,
  fixtureClearances,
  fixtureWorldRect,
  footprintFromBasis,
  interiorRect,
  interiorWH,
  MIN_ROOM_SIZE,
  moveTo,
  nudge,
  lengthLabel,
  openingGapRect,
  openingHitRect,
  openingHitTest,
  openingMeasures,
  openingOffsetAt,
  rectFromCorners,
  rectilinearRings,
  rotate90,
  sameRect,
  snapScalar,
  snapTo,
  sqFt,
  usableSqFt,
  wallBand,
  wallSegments,
  WORLD,
} from '../app/utils/geometry'

const g = (x: number, y: number, w: number, h: number, notches: Omit<Notch, 'id'>[] = []): Geometry => ({
  x, y, w, h, rotation: 0,
  notches: notches.map((n, i) => ({ id: `n${i}`, ...n })),
})

// Full-shape geometry for the wall/opening/fixture suites.
const gw = (over: Partial<Geometry> & { x: number, y: number, w: number, h: number }): Geometry =>
  ({ ...emptyGeometry(over), ...over })

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

describe('rectilinearRings + notch-aware sqFt', () => {
  it('a plain rect is a single 4-point ring with full area', () => {
    const rings = rectilinearRings(g(0, 0, 120, 120))
    expect(rings).toHaveLength(1)
    expect(rings[0]).toHaveLength(4)
    expect(sqFt(g(0, 0, 120, 120))).toBe(100)
  })

  it('a corner notch yields a clean 6-point L outline and subtracts its area', () => {
    // 120×120 room with a 60×60 cut out of the top-right corner.
    const geo = g(0, 0, 120, 120, [{ x: 60, y: 0, w: 60, h: 60 }])
    const rings = rectilinearRings(geo)
    expect(rings).toHaveLength(1)
    expect(rings[0]).toHaveLength(6)
    expect(sqFt(geo)).toBe(75) // (120·120 − 60·60)/144
  })

  it('an edge notch yields a U outline (8 points)', () => {
    const geo = g(0, 0, 120, 60, [{ x: 40, y: 0, w: 40, h: 30 }])
    const rings = rectilinearRings(geo)
    expect(rings).toHaveLength(1)
    expect(rings[0]).toHaveLength(8)
    expect(sqFt(geo)).toBe(42) // (7200 − 1200)/144 = 41.67 → 42
  })

  it('an interior notch yields a hole (two rings) and subtracts its area', () => {
    const geo = g(0, 0, 120, 120, [{ x: 40, y: 40, w: 40, h: 40 }])
    const rings = rectilinearRings(geo)
    expect(rings).toHaveLength(2)
    expect(sqFt(geo)).toBe(89) // (14400 − 1600)/144 = 88.9 → 89
  })

  it('clips notches that overrun the room and ignores fully-outside ones', () => {
    const overrun = g(0, 0, 120, 120, [{ x: 90, y: 90, w: 999, h: 999 }]) // covers bottom-right 30×30
    expect(sqFt(overrun)).toBe(94) // (14400 − 900)/144 = 93.75 → 94
    const outside = g(0, 0, 120, 120, [{ x: 200, y: 200, w: 40, h: 40 }])
    expect(sqFt(outside)).toBe(100)
  })
})

describe('snapScalar', () => {
  it('snaps to the nearest target within tolerance and reports the line', () => {
    expect(snapScalar(102, [100, 200], 9)).toEqual({ value: 100, snapped: 100 })
    expect(snapScalar(196, [100, 200], 9)).toEqual({ value: 200, snapped: 200 })
  })
  it('does not snap beyond tolerance', () => {
    expect(snapScalar(115, [100, 200], 9)).toEqual({ value: 115, snapped: null })
    expect(snapScalar(50, [], 9)).toEqual({ value: 50, snapped: null })
  })
})

describe('edgeSnapTargets', () => {
  it('collects other rooms’ outer + notch edge lines, excluding the dragged room', () => {
    const rooms = [
      { id: 'a', geometry: g(0, 0, 120, 60, [{ x: 100, y: 0, w: 20, h: 30 }]) },
      { id: 'b', geometry: g(200, 200, 60, 60) },
    ]
    const t = edgeSnapTargets(rooms, 'b') // dragging b → snap to a only
    expect(t.xs.sort((p, q) => p - q)).toEqual([0, 100, 120]) // 0, x+w=120, notch at 100/120
    expect(t.ys.sort((p, q) => p - q)).toEqual([0, 30, 60]) // 0, 60, notch bottom 30
    expect(edgeSnapTargets(rooms, 'b').xs).not.toContain(200) // b excluded
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

describe('effectiveGeometry — non-destructive overlap auto-cut', () => {
  const A = { id: 'a', z: 0, geometry: g(0, 0, 120, 120) }
  const B = { id: 'b', z: 1, geometry: g(60, 60, 120, 120) }

  it('bites the overlap out of the lower room as a relative notch', () => {
    const eff = effectiveGeometry(A, [A, B])
    expect(eff.notches.at(-1)).toMatchObject({ x: 60, y: 60, w: 60, h: 60 })
    expect(sqFt(eff)).toBe(75) // (120·120 − 60·60)/144
  })

  it('leaves the higher (covering) room untouched', () => {
    const eff = effectiveGeometry(B, [A, B])
    expect(eff).toBe(B.geometry) // same reference, no cuts
    expect(sqFt(eff)).toBe(100)
  })

  it('breaks z ties by stacking order (later in the array is on top)', () => {
    const lo = { id: 'lo', z: 0, geometry: g(0, 0, 120, 120) }
    const hi = { id: 'hi', z: 0, geometry: g(60, 0, 120, 120) }
    expect(effectiveGeometry(lo, [lo, hi]).notches).toHaveLength(1)
    expect(effectiveGeometry(hi, [lo, hi]).notches).toHaveLength(0)
  })

  it('flush-touching rooms cut nothing', () => {
    const left = { id: 'l', z: 0, geometry: g(0, 0, 120, 120) }
    const right = { id: 'r', z: 1, geometry: g(120, 0, 120, 120) }
    expect(effectiveGeometry(left, [left, right])).toBe(left.geometry)
  })

  it('restores when the cover moves away (recompute is pure)', () => {
    const moved = { ...B, geometry: g(300, 300, 120, 120) }
    expect(effectiveGeometry(A, [A, moved])).toBe(A.geometry)
  })
})

describe('walls / interior', () => {
  const room = gw({ x: 0, y: 0, w: 144, h: 120, walls: { n: 6, s: 6, e: 4, w: 4 } })

  it('insets the interior rect by each wall thickness', () => {
    expect(interiorRect(room)).toEqual({ x: 4, y: 6, w: 136, h: 108 })
    expect(interiorWH(room)).toEqual({ w: 136, h: 108 })
  })

  it('usable sqFt is the interior area; equals gross when wall-less', () => {
    expect(usableSqFt(room)).toBe(Math.round((136 * 108) / 144)) // 102
    expect(usableSqFt(g(0, 0, 144, 120))).toBe(sqFt(g(0, 0, 144, 120)))
  })

  it('subtracts overlap cuts from the interior too', () => {
    const eff = { ...room, notches: [{ id: 'c', x: 100, y: 0, w: 44, h: 120 }] }
    expect(usableSqFt(eff)).toBeLessThan(usableSqFt(room))
  })
})

describe('wall bands & segments', () => {
  it('a wall with no thickness yields no band', () => {
    const room = gw({ x: 0, y: 0, w: 200, h: 100, walls: { n: 6, s: 0, e: 0, w: 0 } })
    expect(wallBand(room, 'n')).toEqual({ x: 0, y: 0, w: 200, h: 6 })
    expect(wallBand(room, 's')).toBeNull()
  })

  it('an opening splits its wall band into two solid pieces', () => {
    const door: Opening = { id: 'd', kind: 'door', wall: 'n', offset: 100, width: 36 }
    const room = gw({ x: 0, y: 0, w: 240, h: 120, walls: { n: 6, s: 0, e: 0, w: 0 }, openings: [door] })
    expect(wallSegments(room)).toEqual([
      { x: 0, y: 0, w: 100, h: 6 },
      { x: 136, y: 0, w: 104, h: 6 },
    ])
  })

  it('opening gap spans the wall thickness on the correct face', () => {
    const room = gw({ x: 0, y: 0, w: 240, h: 120, walls: { n: 6, s: 8, e: 0, w: 0 } })
    expect(openingGapRect(room, { id: 'n', kind: 'door', wall: 'n', offset: 100, width: 36 }))
      .toEqual({ x: 100, y: 0, w: 36, h: 6 })
    expect(openingGapRect(room, { id: 's', kind: 'door', wall: 's', offset: 100, width: 36 }))
      .toEqual({ x: 100, y: 112, w: 36, h: 8 }) // y+h − thickness = 120−8
  })
})

describe('opening move + measurement', () => {
  const room = gw({ x: 0, y: 0, w: 240, h: 120, walls: { n: 6, s: 0, e: 0, w: 0 } })
  const door: Opening = { id: 'd', kind: 'door', wall: 'n', offset: 100, width: 36 }

  it('lengthLabel formats inches as feet-inches', () => {
    expect(lengthLabel(30)).toBe('2\'6"')
    expect(lengthLabel(24)).toBe('2\'')
  })

  it('openingOffsetAt projects, snaps and clamps onto the wall', () => {
    expect(openingOffsetAt(room, door, { x: 120, y: 2 }, 6)).toBe(120)
    expect(openingOffsetAt(room, door, { x: 9999, y: 2 }, 6)).toBe(240 - 36) // clamped to wall end
    expect(openingOffsetAt(room, door, { x: 130, y: 2 }, 6, 10)).toBe(120) // grab offset honored
  })

  it('openingHitRect spans the opening width with an interior-biased band', () => {
    const r = openingHitRect(room, door)
    expect(r.x).toBe(100)
    expect(r.w).toBe(36)
    expect(r.h).toBe(6 + 22) // wall thickness + grab band
    expect(r.y).toBe(-4) // small lip above the top edge, rest inside
  })

  it('openingMeasures returns the opening width plus the gap to each corner', () => {
    const m = openingMeasures(room, door)
    expect(m).toHaveLength(3)
    expect(m[0]).toMatchObject({ x: 50, text: lengthLabel(100) }) // before gap mid
    expect(m[1]).toMatchObject({ x: 118, text: lengthLabel(36) }) // opening width mid (100 + 36/2)
    expect(m[2]).toMatchObject({ x: 188, text: lengthLabel(104) }) // after gap mid (240-100-36)
  })

  it('omits the flush-corner gap but keeps the opening width', () => {
    // offset 0 → no "before" gap; width + "after" gap remain
    expect(openingMeasures(room, { ...door, offset: 0 })).toHaveLength(2)
  })
})

describe('fixtureClearances', () => {
  const room: Geometry = gw({ x: 0, y: 0, w: 120, h: 96 })
  const fixture: Fixture = { id: 'f1', kind: 'tub', x: 20, y: 30, w: 40, h: 20, rotation: 0 }

  it('labels the gap to the nearest wall on each axis, centered in the gap', () => {
    // world rect = { x:20, y:30, w:40, h:20 } → left 20 (< right 60), top 30 (< bottom 46)
    const c = fixtureClearances(room, fixture)
    expect(c).toHaveLength(2)
    expect(c[0]).toMatchObject({ x: 10, y: 40, text: lengthLabel(20) }) // nearest horizontal (left)
    expect(c[1]).toMatchObject({ x: 40, y: 15, text: lengthLabel(30) }) // nearest vertical (top)
  })

  it('omits an axis when the fixture is flush to a wall', () => {
    const flush: Fixture = { ...fixture, x: 0, y: 0 } // touches left + top walls
    expect(fixtureClearances(room, flush)).toHaveLength(0)
  })
})

describe('openingHitTest', () => {
  const room = gw({ x: 0, y: 0, w: 240, h: 120 })

  it('picks the nearest wall and centers a snapped, on-wall offset', () => {
    expect(openingHitTest(room, { x: 120, y: 2 }, 36, 6)).toEqual({ wall: 'n', offset: 102 })
    expect(openingHitTest(room, { x: 2, y: 60 }, 36, 6)).toEqual({ wall: 'w', offset: 42 })
  })

  it('keeps the opening fully on the wall near a corner', () => {
    expect(openingHitTest(room, { x: 238, y: 2 }, 36, 6)?.offset).toBe(240 - 36)
  })

  it('returns null away from every edge', () => {
    expect(openingHitTest(room, { x: 120, y: 60 }, 36, 6)).toBeNull()
  })
})

describe('doorGeometry', () => {
  it('places hinge, leaf tip and latch for a left-hinged inward door', () => {
    const room = g(0, 0, 120, 120)
    const d = doorGeometry(room, { id: 'd', kind: 'door', wall: 'n', offset: 0, width: 36, hinge: 'left', swing: 'in' })
    expect(d.hinge).toEqual({ x: 0, y: 0 })
    expect(d.latch).toEqual({ x: 36, y: 0 })
    expect(d.open).toEqual({ x: 0, y: 36 }) // swings into the room (+y)
    expect(d.radius).toBe(36)
  })

  it('swings outward away from the room', () => {
    const room = g(0, 0, 120, 120)
    const d = doorGeometry(room, { id: 'd', kind: 'door', wall: 'n', offset: 0, width: 36, hinge: 'left', swing: 'out' })
    expect(d.open).toEqual({ x: 0, y: -36 })
  })
})

describe('fixtureWorldRect', () => {
  const room = g(10, 20, 200, 200)
  it('offsets by room origin at rotation 0', () => {
    const f: Fixture = { id: 'f', kind: 'tub', x: 5, y: 5, w: 60, h: 30, rotation: 0 }
    expect(fixtureWorldRect(room, f)).toEqual({ x: 15, y: 25, w: 60, h: 30 })
  })
  it('swaps w/h about the center at 90°', () => {
    const f: Fixture = { id: 'f', kind: 'tub', x: 5, y: 5, w: 60, h: 30, rotation: 90 }
    expect(fixtureWorldRect(room, f)).toEqual({ x: 30, y: 10, w: 30, h: 60 })
  })
})

describe('rotate90 — content remap', () => {
  it('rotates walls n→e→s→w and swaps the footprint', () => {
    const room = gw({ x: 0, y: 0, w: 120, h: 60, walls: { n: 4, s: 0, e: 0, w: 8 } })
    const r = rotate90(room, 6)
    expect([r.w, r.h]).toEqual([60, 120])
    expect(r.walls).toEqual({ n: 8, e: 4, s: 0, w: 0 })
  })

  it('remaps openings onto their rotated wall', () => {
    const room = gw({
      x: 0,
      y: 0,
      w: 120,
      h: 60,
      openings: [
        { id: 'a', kind: 'door', wall: 'n', offset: 10, width: 20 },
        { id: 'b', kind: 'window', wall: 'e', offset: 5, width: 10 },
      ],
    })
    const r = rotate90(room, 6)
    expect(r.openings[0]).toMatchObject({ wall: 'e', offset: 10 })
    expect(r.openings[1]).toMatchObject({ wall: 's', offset: 60 - (5 + 10) }) // newW=oldH=60
  })

  it('rotates fixtures about the room (world footprint swaps, center maps CW)', () => {
    const f: Fixture = { id: 'f', kind: 'tub', x: 10, y: 5, w: 20, h: 10, rotation: 0 }
    const room = gw({ x: 0, y: 0, w: 120, h: 60, fixtures: [f] })
    const before = fixtureWorldRect(room, f)
    const r = rotate90(room, 6)
    const after = fixtureWorldRect(r, r.fixtures[0]!)
    expect([after.w, after.h]).toEqual([before.h, before.w]) // world w/h swap
    // local center (relative to room origin) maps (lx,ly) → (oldH − ly, lx), oldH = 60
    const beforeLx = before.x - room.x + before.w / 2
    const beforeLy = before.y - room.y + before.h / 2
    expect(after.x - r.x + after.w / 2).toBe(60 - beforeLy)
    expect(after.y - r.y + after.h / 2).toBe(beforeLx)
  })
})

describe('dimension basis', () => {
  const room = gw({ x: 0, y: 0, w: 144, h: 120, walls: { n: 4, s: 4, e: 6, w: 6 }, basis: 'interior' })
  it('basisWH subtracts walls in interior basis', () => {
    expect(basisWH(room)).toEqual({ w: 144 - 12, h: 120 - 8 })
    expect(basisWH({ ...room, basis: 'exterior' })).toEqual({ w: 144, h: 120 })
  })
  it('footprintFromBasis adds the walls back for interior input', () => {
    expect(footprintFromBasis(room, 100, 80)).toEqual({ w: 112, h: 88 })
    expect(footprintFromBasis({ ...room, basis: 'exterior' }, 100, 80)).toEqual({ w: 100, h: 80 })
  })
})
