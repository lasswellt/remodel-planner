import type { RoomStatus } from '~/models'

// Room-status visual encoding shared by the live canvas and the standalone
// SVG/PNG export. Color is never the only channel (Build Conventions): planned
// rects are dash-outlined, in-progress solid, done solid + a "✓" in the label.
export interface StatusStyle {
  fill: string
  stroke: string
  /** SVG stroke-dasharray, or undefined for a solid outline. */
  dash?: string
}

export const STATUS_STYLES: Record<RoomStatus, StatusStyle> = {
  'planned': { fill: '#ECEFF4', stroke: '#5B7083', dash: '8 6' },
  'in-progress': { fill: '#E3F0FF', stroke: '#1565C0' },
  'done': { fill: '#E6F4EA', stroke: '#2E7D32' },
}

export const RING_TRACK = '#C2CAD6'
export const RING_ARC = '#1565C0'
export const RING_DONE = '#2E7D32'
export const LABEL_COLOR = '#1A1C1E'
export const GRID_MINOR = '#E4E8EE'
export const GRID_MAJOR = '#CDD4DE'
export const PLAN_BG = '#FFFFFF'

// Walls render as a solid structural band, darker than any room fill so the
// shell reads as built mass. Openings cut the band; the gap shows PLAN_BG.
export const WALL_FILL = '#8A93A1'
export const WALL_STROKE = '#5B6472'
// Door leaf + swing arc; window glazing (distinct hue so glass ≠ door).
export const DOOR_COLOR = '#5B6472'
export const WINDOW_COLOR = '#2E78C7'
// Fixtures: a light card on the floor with a legible outline + label.
export const FIXTURE_FILL = '#EEF1F5'
export const FIXTURE_STROKE = '#6B7280'
export const FIXTURE_DETAIL = '#9AA4B2'
export const FIXTURE_LABEL = '#3A4250'
export const FIXTURE_SELECTED = '#1565C0'

export const FONT_STACK
  = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
