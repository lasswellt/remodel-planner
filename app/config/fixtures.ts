import type { FixtureKind } from '~/models'
import { FixtureKind as FixtureKindEnum } from '~/models'

// Catalog of placeable fixtures / obstructions. Default sizes are typical
// real-world footprints in INCHES (w × h, matching the plan's world units).
// `icon` is an mdi glyph used in the palette + summary panel only — the SVG plan
// and export render a fixture as a labeled box (no webfont dependency), so the
// catalog never needs to ship icon paths.
export interface FixtureSpec {
  label: string
  w: number
  h: number
  icon: string
}

export const FIXTURE_CATALOG: Record<FixtureKind, FixtureSpec> = {
  'tub': { label: 'Tub', w: 60, h: 30, icon: 'mdi-bathtub-outline' },
  'shower': { label: 'Shower', w: 36, h: 36, icon: 'mdi-shower' },
  'toilet': { label: 'Toilet', w: 20, h: 28, icon: 'mdi-toilet' },
  'sink': { label: 'Sink', w: 24, h: 20, icon: 'mdi-sink' },
  'vanity': { label: 'Vanity', w: 36, h: 21, icon: 'mdi-countertop-outline' },
  'fridge': { label: 'Fridge', w: 36, h: 33, icon: 'mdi-fridge-outline' },
  'range': { label: 'Range', w: 30, h: 25, icon: 'mdi-stove' },
  'dishwasher': { label: 'Dishwasher', w: 24, h: 24, icon: 'mdi-dishwasher' },
  'washer': { label: 'Washer', w: 27, h: 30, icon: 'mdi-washing-machine' },
  'dryer': { label: 'Dryer', w: 27, h: 30, icon: 'mdi-tumble-dryer' },
  'island': { label: 'Island', w: 72, h: 40, icon: 'mdi-countertop' },
  'water-heater': { label: 'Water heater', w: 22, h: 22, icon: 'mdi-water-boiler' },
  'generic': { label: 'Box', w: 24, h: 24, icon: 'mdi-shape-rectangle-plus' },
}

// Palette order — most-reached-for fixtures first; generic box last.
export const FIXTURE_PALETTE: FixtureKind[] = [
  'tub',
  'shower',
  'toilet',
  'sink',
  'vanity',
  'fridge',
  'range',
  'dishwasher',
  'washer',
  'dryer',
  'island',
  'water-heater',
  'generic',
]

export const FIXTURE_OPTIONS = FixtureKindEnum.options.map(value => ({
  value,
  title: FIXTURE_CATALOG[value].label,
  icon: FIXTURE_CATALOG[value].icon,
}))

// Resolved display label for a fixture instance (custom label wins).
export function fixtureLabel(kind: FixtureKind, label?: string): string {
  return label?.trim() || FIXTURE_CATALOG[kind].label
}
