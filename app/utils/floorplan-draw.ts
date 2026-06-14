import type { FixtureKind, Geometry, Opening } from '~/models'
import { doorGeometry, type Rect, wallAxis, wallSegments } from '~/utils/geometry'
import {
  DOOR_COLOR,
  FIXTURE_DETAIL,
  WALL_FILL,
  WALL_STROKE,
  WINDOW_COLOR,
} from '~/utils/floorplan-style'

// Renderer-agnostic SVG primitive descriptors. The live canvas maps these to
// Vue SVG elements (FloorplanPrims.vue); the standalone export stringifies them
// (primsSvg) — one source of truth for wall/opening/fixture visuals.
export type Prim =
  | { t: 'line', x1: number, y1: number, x2: number, y2: number, stroke: string, sw?: number, dash?: string }
  | { t: 'rect', x: number, y: number, w: number, h: number, fill?: string, stroke?: string, sw?: number, dash?: string, rx?: number }
  | { t: 'path', d: string, stroke?: string, fill?: string, sw?: number, dash?: string }
  | { t: 'ellipse', cx: number, cy: number, rx: number, ry: number, fill?: string, stroke?: string, sw?: number }

const RENDER_BAND = 5 // min visual wall thickness for an opening on a wall-less edge

// ---- walls ----

// Wall band pieces, already split around openings by wallSegments.
export function wallPrims(geo: Geometry): Prim[] {
  return wallSegments(geo).map(r => ({
    t: 'rect',
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    fill: WALL_FILL,
    stroke: WALL_STROKE,
    sw: 0.5,
  }))
}

// ---- openings ----

export function openingPrims(geo: Geometry, op: Opening): Prim[] {
  return op.kind === 'window' ? windowPrims(geo, op) : doorPrims(geo, op)
}

export function allOpeningPrims(geo: Geometry): Prim[] {
  return (geo.openings ?? []).flatMap(op => openingPrims(geo, op))
}

function windowPrims(geo: Geometry, op: Opening): Prim[] {
  const ax = wallAxis(geo, op.wall)
  const t = Math.max(ax.thickness, RENDER_BAND)
  const j0 = { x: ax.ax + ax.dx * op.offset, y: ax.ay + ax.dy * op.offset }
  const j1 = { x: ax.ax + ax.dx * (op.offset + op.width), y: ax.ay + ax.dy * (op.offset + op.width) }
  const off = (k: number) => ({ nx: ax.nx * k, ny: ax.ny * k })
  const face = off(t)
  const mid = off(t / 2)
  // two wall faces + a center glazing line across the opening
  return [
    { t: 'line', x1: j0.x, y1: j0.y, x2: j1.x, y2: j1.y, stroke: WINDOW_COLOR, sw: 1 },
    { t: 'line', x1: j0.x + face.nx, y1: j0.y + face.ny, x2: j1.x + face.nx, y2: j1.y + face.ny, stroke: WINDOW_COLOR, sw: 1 },
    { t: 'line', x1: j0.x + mid.nx, y1: j0.y + mid.ny, x2: j1.x + mid.nx, y2: j1.y + mid.ny, stroke: WINDOW_COLOR, sw: 1.5 },
  ]
}

function leafArc(d: ReturnType<typeof doorGeometry>): Prim[] {
  return [
    { t: 'line', x1: d.hinge.x, y1: d.hinge.y, x2: d.open.x, y2: d.open.y, stroke: DOOR_COLOR, sw: 1.5 },
    { t: 'path', d: `M ${d.open.x} ${d.open.y} A ${d.radius} ${d.radius} 0 0 ${d.sweep} ${d.latch.x} ${d.latch.y}`, stroke: DOOR_COLOR, fill: 'none', sw: 1, dash: '3 3' },
  ]
}

function jambTicks(geo: Geometry, op: Opening): Prim[] {
  const ax = wallAxis(geo, op.wall)
  const t = Math.max(ax.thickness, RENDER_BAND)
  return [op.offset, op.offset + op.width].map((o) => {
    const bx = ax.ax + ax.dx * o
    const by = ax.ay + ax.dy * o
    return { t: 'line', x1: bx, y1: by, x2: bx + ax.nx * t, y2: by + ax.ny * t, stroke: DOOR_COLOR, sw: 1 }
  })
}

function doorPrims(geo: Geometry, op: Opening): Prim[] {
  const type = op.doorType ?? 'single'
  switch (type) {
    case 'cased-opening':
      return jambTicks(geo, op)
    case 'sliding':
      return slidingPrims(geo, op)
    case 'pocket':
      return [...jambTicks(geo, op), ...pocketPrims(geo, op)]
    case 'bifold':
      return bifoldPrims(geo, op)
    case 'double': {
      const half = op.width / 2
      return [
        ...leafArc(doorGeometry(geo, { ...op, hinge: 'left' }, { offset: op.offset, width: half })),
        ...leafArc(doorGeometry(geo, { ...op, hinge: 'right' }, { offset: op.offset + half, width: half })),
      ]
    }
    default:
      return leafArc(doorGeometry(geo, op))
  }
}

function slidingPrims(geo: Geometry, op: Opening): Prim[] {
  const ax = wallAxis(geo, op.wall)
  const t = Math.max(ax.thickness, RENDER_BAND)
  const half = op.width / 2
  const pt = Math.max(2, t * 0.35)
  const panel = (o0: number, len: number, faceK: number): Prim => {
    const sx = ax.ax + ax.dx * o0 + ax.nx * faceK
    const sy = ax.ay + ax.dy * o0 + ax.ny * faceK
    return ax.dx !== 0
      ? { t: 'rect', x: sx, y: sy - pt / 2, w: len, h: pt, fill: DOOR_COLOR }
      : { t: 'rect', x: sx - pt / 2, y: sy, w: pt, h: len, fill: DOOR_COLOR }
  }
  // two overlapping panels straddling the wall centerline
  return [panel(op.offset, half + 2, t * 0.32), panel(op.offset + half - 2, half + 2, t * 0.68)]
}

function pocketPrims(geo: Geometry, op: Opening): Prim[] {
  const ax = wallAxis(geo, op.wall)
  const t = Math.max(ax.thickness, RENDER_BAND)
  const pt = Math.max(2, t * 0.4)
  const cShift = t / 2
  return ax.dx !== 0
    ? [{ t: 'rect', x: ax.ax + ax.dx * op.offset, y: ax.ay + ax.ny * cShift - pt / 2, w: op.width, h: pt, stroke: DOOR_COLOR, fill: 'none', sw: 1, dash: '4 3' }]
    : [{ t: 'rect', x: ax.ax + ax.nx * cShift - pt / 2, y: ax.ay + ax.dy * op.offset, w: pt, h: op.width, stroke: DOOR_COLOR, fill: 'none', sw: 1, dash: '4 3' }]
}

function bifoldPrims(geo: Geometry, op: Opening): Prim[] {
  const ax = wallAxis(geo, op.wall)
  const swingIn = (op.swing ?? 'in') === 'in'
  const px = swingIn ? ax.nx : -ax.nx
  const py = swingIn ? ax.ny : -ax.ny
  const face = swingIn ? Math.max(ax.thickness, 0) : 0
  const j0 = { x: ax.ax + ax.dx * op.offset + ax.nx * face, y: ax.ay + ax.dy * op.offset + ax.ny * face }
  const j1 = { x: ax.ax + ax.dx * (op.offset + op.width) + ax.nx * face, y: ax.ay + ax.dy * (op.offset + op.width) + ax.ny * face }
  const mid = { x: (j0.x + j1.x) / 2, y: (j0.y + j1.y) / 2 }
  const depth = op.width / 3
  const q0 = { x: (j0.x + mid.x) / 2 + px * depth, y: (j0.y + mid.y) / 2 + py * depth }
  const q1 = { x: (j1.x + mid.x) / 2 + px * depth, y: (j1.y + mid.y) / 2 + py * depth }
  const seg = (a: { x: number, y: number }, b: { x: number, y: number }): Prim =>
    ({ t: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: DOOR_COLOR, sw: 1.5 })
  return [seg(j0, q0), seg(q0, mid), seg(mid, q1), seg(q1, j1)]
}

// ---- fixtures ----

// Inner detail that makes a fixture recognizable (basin, bowl, drain). The box +
// label are drawn by the renderer; this adds the kind-specific flourish.
export function fixtureDetailPrims(r: Rect, kind: FixtureKind): Prim[] {
  const inset = Math.max(2, Math.min(4, r.w / 6, r.h / 6))
  switch (kind) {
    case 'tub':
      return [{ t: 'rect', x: r.x + inset, y: r.y + inset, w: r.w - 2 * inset, h: r.h - 2 * inset, rx: Math.min(r.w, r.h) / 4, stroke: FIXTURE_DETAIL, fill: 'none', sw: 1 }]
    case 'sink':
      return [{ t: 'ellipse', cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: (r.w - 2 * inset) / 2, ry: (r.h - 2 * inset) / 2, stroke: FIXTURE_DETAIL, fill: 'none', sw: 1 }]
    case 'toilet':
      return [
        { t: 'ellipse', cx: r.x + r.w / 2, cy: r.y + r.h * 0.6, rx: r.w * 0.34, ry: r.h * 0.3, stroke: FIXTURE_DETAIL, fill: 'none', sw: 1 },
        { t: 'rect', x: r.x + r.w * 0.2, y: r.y + r.h * 0.03, w: r.w * 0.6, h: r.h * 0.22, stroke: FIXTURE_DETAIL, fill: 'none', sw: 1 },
      ]
    case 'shower':
      return [
        { t: 'line', x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, stroke: FIXTURE_DETAIL, sw: 1 },
        { t: 'line', x1: r.x + r.w, y1: r.y, x2: r.x, y2: r.y + r.h, stroke: FIXTURE_DETAIL, sw: 1 },
      ]
    default:
      return []
  }
}

// ---- export stringifier ----

export function primSvg(p: Prim): string {
  const dash = p.t !== 'ellipse' && p.dash ? ` stroke-dasharray="${p.dash}"` : ''
  const strokeOf = (stroke?: string, sw?: number) =>
    stroke ? ` stroke="${stroke}" stroke-width="${sw ?? 1}"` : ''
  switch (p.t) {
    case 'line':
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.sw ?? 1}"${dash}/>`
    case 'rect':
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"${p.rx ? ` rx="${p.rx}"` : ''} fill="${p.fill ?? 'none'}"${strokeOf(p.stroke, p.sw)}${dash}/>`
    case 'path':
      return `<path d="${p.d}" fill="${p.fill ?? 'none'}"${strokeOf(p.stroke, p.sw)}${dash}/>`
    case 'ellipse':
      return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${p.fill ?? 'none'}"${strokeOf(p.stroke, p.sw)}/>`
  }
}

export function primsSvg(prims: Prim[]): string {
  return prims.map(primSvg).join('')
}
