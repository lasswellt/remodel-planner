import { describe, expect, it } from 'vitest'
import type { Notch } from '../app/models'
import { buildRoomPath } from '../app/utils/geometry'

// Guards the rendered SVG outline: a corner/edge notch must produce a single
// clean rectilinear ring (so the stroke never crosses the cut), and an interior
// notch must produce a hole (a second subpath rendered via fill-rule evenodd).
const room = (x: number, y: number, w: number, h: number, notches: Omit<Notch, 'id'>[] = []) =>
  ({ x, y, w, h, rotation: 0, notches: notches.map((n, i) => ({ id: `n${i}`, ...n })) })

describe('buildRoomPath', () => {
  it('renders a plain rect as a single 4-corner path', () => {
    expect(buildRoomPath(room(20, 30, 170, 120)))
      .toBe('M 20 30 L 190 30 L 190 150 L 20 150 Z')
  })

  it('renders a corner notch as a clean L outline (one ring, no cut-crossing edge)', () => {
    expect(buildRoomPath(room(0, 0, 120, 120, [{ x: 60, y: 0, w: 60, h: 60 }])))
      .toBe('M 0 0 L 60 0 L 60 60 L 120 60 L 120 120 L 0 120 Z')
  })

  it('renders an interior notch as an outer ring plus a hole ring', () => {
    const d = buildRoomPath(room(0, 0, 120, 120, [{ x: 40, y: 40, w: 40, h: 40 }]))
    expect((d.match(/M /g) ?? []).length).toBe(2)
  })
})
