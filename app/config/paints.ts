import type { PaintFinish, PaintSurface } from '~/models'
import { PaintFinish as FinishEnum, PaintSurface as SurfaceEnum } from '~/models'

// Display labels + select options for paint finish (sheen) and surface, shared
// by the paint dialog and the room paint list. Slugs are the enum values.
export const PAINT_FINISH_LABELS: Record<PaintFinish, string> = {
  'flat': 'Flat',
  'matte': 'Matte',
  'eggshell': 'Eggshell',
  'satin': 'Satin',
  'semi-gloss': 'Semi-gloss',
  'gloss': 'Gloss',
}

export const PAINT_SURFACE_LABELS: Record<PaintSurface, string> = {
  'walls': 'Walls',
  'trim': 'Trim',
  'ceiling': 'Ceiling',
  'cabinets': 'Cabinets',
  'doors': 'Doors',
  'accent-wall': 'Accent wall',
  'exterior': 'Exterior',
}

export const PAINT_FINISH_OPTIONS = FinishEnum.options.map(value => ({
  value,
  title: PAINT_FINISH_LABELS[value],
}))

export const PAINT_SURFACE_OPTIONS = SurfaceEnum.options.map(value => ({
  value,
  title: PAINT_SURFACE_LABELS[value],
}))

// Common brands for the brand combobox. Free text — not a closed set; these
// just seed the autocomplete.
export const PAINT_BRAND_SUGGESTIONS = [
  'Sherwin-Williams',
  'Benjamin Moore',
  'Behr',
  'Valspar',
  'PPG',
  'Farrow & Ball',
  'Dunn-Edwards',
  'Kilz',
]
