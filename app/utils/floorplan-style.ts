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

export const FONT_STACK
  = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
