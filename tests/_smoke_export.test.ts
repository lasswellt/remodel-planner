import { describe, expect, it } from 'vitest'
import type { Room } from '../app/models'
import { buildFloorplanSvg } from '../app/utils/floorplan-export'

// End-to-end guard for the export path: walls, door swing arcs, window glazing,
// fixtures and the non-destructive overlap bite must all reach the standalone
// SVG (so an exported plan matches the live canvas).
const base = { uid: 'u', projectId: 'p', status: 'in-progress' as const }

const rooms: Room[] = [
  {
    ...base,
    id: 'bath',
    name: 'Bathroom',
    type: 'bathroom',
    floor: 1,
    z: 0,
    geometry: {
      x: 60, y: 60, w: 144, h: 120, rotation: 0, notches: [],
      walls: { n: 6, s: 6, e: 4.5, w: 4.5 },
      basis: 'exterior',
      openings: [
        { id: 'd1', kind: 'door', wall: 's', offset: 40, width: 32, doorType: 'single', hinge: 'left', swing: 'in' },
        { id: 'w1', kind: 'window', wall: 'n', offset: 50, width: 36, sill: 36, height: 48 },
      ],
      fixtures: [
        { id: 'f1', kind: 'tub', x: 8, y: 8, w: 60, h: 30, rotation: 0 },
        { id: 'f2', kind: 'toilet', x: 100, y: 70, w: 20, h: 28, rotation: 0 },
      ],
    },
  },
  {
    // Higher z → bites the bathroom where the two overlap.
    ...base,
    id: 'closet',
    name: 'Closet',
    type: 'bedroom',
    floor: 1,
    z: 1,
    geometry: {
      x: 170, y: 140, w: 90, h: 90, rotation: 0, notches: [],
      walls: { n: 0, s: 0, e: 0, w: 0 }, basis: 'exterior', openings: [], fixtures: [],
    },
  },
]

describe('buildFloorplanSvg with walls / openings / fixtures', () => {
  const svg = buildFloorplanSvg({ rooms, gridStep: 6, title: 'Smoke', progressByRoom: {}, statusByRoom: {} })

  it('renders the door swing arc with radius = door width', () => {
    expect(svg).toMatch(/A 32 32 0 0 [01]/)
  })

  it('renders wall bands and window glazing', () => {
    expect(svg).toContain('#8A93A1') // wall fill
    expect(svg).toContain('#2E78C7') // window glazing
  })

  it('labels the tub (big enough) and draws the toilet box', () => {
    expect(svg).toContain('Tub')
    expect(svg).toContain('#EEF1F5') // fixture fill (toilet box, no label at 20" wide)
  })

  it('bites the overlap out of the lower room (path is not a plain 4-point rect)', () => {
    // The bathroom outline gains extra vertices where the closet overlaps it.
    const paths = svg.match(/<path d="M [^"]*"/g) ?? []
    const bath = paths.find(p => p.includes('M 60 60'))
    expect(bath).toBeDefined()
    expect((bath!.match(/L /g) ?? []).length).toBeGreaterThan(3)
  })

  it('crops the viewBox to the rooms plus a margin (not the whole world)', () => {
    // bounds: x 60..260, y 60..230; margin 36, clamped to the world.
    expect(svg).toContain('viewBox="24 24 272 242"')
    expect(svg).toContain('width="272" height="242"')
  })
})

describe('buildFloorplanSvg with no rooms', () => {
  it('falls back to the full world viewBox', () => {
    const svg = buildFloorplanSvg({ rooms: [], gridStep: 6, title: 'Empty', progressByRoom: {}, statusByRoom: {} })
    expect(svg).toContain('viewBox="0 0 1440 960"')
    expect(svg).toContain('width="1440" height="960"')
  })
})
