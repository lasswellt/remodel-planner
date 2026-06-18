import type { Fixture, Geometry, Room, RoomStatus } from '~/models'
import { buildRoomPath, effectiveGeometry, fixtureWorldRect, roomsBounds, sqFt, WORLD } from '~/utils/geometry'
import { allOpeningPrims, fixtureDetailPrims, primsSvg, wallPrims } from '~/utils/floorplan-draw'
import { fixtureLabel } from '~/config/fixtures'
import type { Progress } from '~/utils/rollup'
import {
  FIXTURE_FILL,
  FIXTURE_LABEL,
  FIXTURE_STROKE,
  FONT_STACK,
  GRID_MAJOR,
  GRID_MINOR,
  LABEL_COLOR,
  PLAN_BG,
  RING_ARC,
  RING_DONE,
  RING_TRACK,
  STATUS_STYLES,
} from '~/utils/floorplan-style'

// Standalone floorplan export: a self-contained SVG string (inline styles, no
// CSS classes, no external fonts) that opens correctly outside the app, plus a
// PNG raster of the same SVG. Visual encoding mirrors FloorplanRoomRect.

export interface ExportInput {
  rooms: Room[]
  gridStep: number
  title: string
  progressByRoom: Record<string, Progress>
  statusByRoom: Record<string, RoomStatus>
}

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

function ringSvg(geo: Geometry, p: Progress): string {
  if (geo.w < 60 || geo.h < 60) return ''
  const r = 13
  const cx = geo.x + geo.w - r - 8
  const cy = geo.y + r + 8
  const color = p.complete ? RING_DONE : RING_ARC
  // No arc at 0%: a zero-length dash with a round cap paints a phantom dot.
  const arc = p.pct > 0
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="4" pathLength="100" stroke-dasharray="${p.pct} 100" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`
    : ''
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${RING_TRACK}" stroke-width="4"/>${arc}`
}

function fixtureSvg(geo: Geometry, f: Fixture): string {
  const r = fixtureWorldRect(geo, f)
  const detail = primsSvg(fixtureDetailPrims(r, f.kind))
  const text = r.w >= 28 && r.h >= 16
    ? `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 3}" text-anchor="middle" font-family='${FONT_STACK}' font-size="9" fill="${FIXTURE_LABEL}">${esc(fixtureLabel(f.kind, f.label))}</text>`
    : ''
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="2" fill="${FIXTURE_FILL}" stroke="${FIXTURE_STROKE}" stroke-width="1.25"/>${detail}${text}`
}

// `g` is the room's effective geometry (overlap bites already folded in).
function roomSvg(room: Room, g: Geometry, p: Progress, status: RoomStatus): string {
  const style = STATUS_STYLES[status]
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : ''
  const name = (status === 'done' ? '✓ ' : '') + room.name
  const cx = g.x + g.w / 2
  const cy = g.y + g.h / 2
  // Label/checkmark gates mirror FloorplanRoomRect exactly.
  let label = ''
  if (g.h >= 36 && g.w >= 48) {
    label = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family='${FONT_STACK}' font-size="13" font-weight="600" fill="${LABEL_COLOR}">${esc(name)}</text>`
      + `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family='${FONT_STACK}' font-size="11" fill="${LABEL_COLOR}" opacity="0.75">${sqFt(g)} sq ft</text>`
  }
  else if (status === 'done') {
    const size = Math.min(13, g.h - 4, g.w - 4)
    label = `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family='${FONT_STACK}' font-size="${size}" font-weight="600" fill="${LABEL_COLOR}">✓</text>`
  }
  const walls = primsSvg(wallPrims(g))
  const openings = primsSvg(allOpeningPrims(g))
  const fixtures = (g.fixtures ?? []).map(f => fixtureSvg(g, f)).join('')
  return `<g><path d="${buildRoomPath(g)}" fill-rule="evenodd" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5" stroke-linejoin="round"${dash}/>${walls}${openings}${label}${fixtures}${ringSvg(g, p)}</g>`
}

export function buildFloorplanSvg(input: ExportInput): string {
  const major = input.gridStep * 4
  // Effective geometry per room so exports show the same overlap bites as the
  // live canvas. `input.rooms` is one floor (different floors never interact).
  const stack = input.rooms.map(r => ({ id: r.id, z: r.z, geometry: r.geometry }))
  const effOf = (id: string, fallback: Geometry) =>
    effectiveGeometry(stack.find(s => s.id === id)!, stack) ?? fallback
  const roomsMarkup = input.rooms
    .map(r => roomSvg(
      r,
      effOf(r.id, r.geometry),
      input.progressByRoom[r.id] ?? { done: 0, total: 0, pct: 0, complete: false },
      input.statusByRoom[r.id] ?? r.status,
    ))
    .join('\n  ')
  // Crop to the plan (rooms' bounding box + margin) rather than the whole world,
  // so an export is tight around the drawing instead of mostly-empty grid. Empty
  // plans fall back to the full world.
  const v = exportViewBox(input.rooms)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" width="${v.w}" height="${v.h}">
  <title>${esc(input.title)}</title>
  <defs>
    <pattern id="grid-minor" width="${input.gridStep}" height="${input.gridStep}" patternUnits="userSpaceOnUse">
      <path d="M ${input.gridStep} 0 L 0 0 0 ${input.gridStep}" fill="none" stroke="${GRID_MINOR}" stroke-width="0.5"/>
    </pattern>
    <pattern id="grid-major" width="${major}" height="${major}" patternUnits="userSpaceOnUse">
      <rect width="${major}" height="${major}" fill="url(#grid-minor)"/>
      <path d="M ${major} 0 L 0 0 0 ${major}" fill="none" stroke="${GRID_MAJOR}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="${PLAN_BG}"/>
  <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="url(#grid-major)"/>
  ${roomsMarkup}
</svg>
`
}

// The export viewBox: the rooms' bounding box padded by `margin`, clamped to the
// world. Falls back to the whole world for an empty plan.
function exportViewBox(rooms: Room[], margin = 36): { x: number, y: number, w: number, h: number } {
  const b = roomsBounds(rooms)
  if (!b) return { x: 0, y: 0, w: WORLD.w, h: WORLD.h }
  const x = Math.max(0, b.x - margin)
  const y = Math.max(0, b.y - margin)
  return {
    x,
    y,
    w: Math.min(WORLD.w, b.x + b.w + margin) - x,
    h: Math.min(WORLD.h, b.y + b.h + margin) - y,
  }
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    || 'floorplan'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadSvg(svg: string, filename: string): void {
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename)
}

// Rasterize via an offscreen <img> + canvas. The SVG is fully self-contained,
// so no CORS taint; scale 2 keeps labels crisp.
export async function downloadPng(svg: string, filename: string, scale = 2): Promise<void> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
  )
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG rasterization failed'))
      img.src = url
    })
    // Size the raster from the SVG's own (cropped) dimensions, not the world.
    const canvas = document.createElement('canvas')
    canvas.width = (img.naturalWidth || WORLD.w) * scale
    canvas.height = (img.naturalHeight || WORLD.h) * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.fillStyle = PLAN_BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
    )
    downloadBlob(blob, filename)
  }
  finally {
    URL.revokeObjectURL(url)
  }
}
