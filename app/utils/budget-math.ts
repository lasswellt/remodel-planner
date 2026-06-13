import type { BudgetCategory, RoomType } from '~/models'
import { BudgetCategory as BudgetCategoryEnum } from '~/models'

// THE budget math source (Build Conventions: money is integer cents, no float
// arithmetic). Pure over plain arrays so the dashboard, room panels, floorplan
// over-budget markers, and unit tests all agree. Formatting to dollars happens
// only at the render boundary via utils/money.ts.

export interface BudgetLineLike {
  roomId: string
  category: BudgetCategory
  estimateCents: number
  actualCents?: number
}

export const BUDGET_CATEGORIES: readonly BudgetCategory[] = BudgetCategoryEnum.options

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  materials: 'Materials',
  labor: 'Labor',
  permits: 'Permits',
  fixtures: 'Fixtures',
  other: 'Other',
}

// Distinct, color-blind-safe-ish hues for the category donut / stacked bar.
// Paired with labels (never color-only) per Build Conventions.
export const BUDGET_CATEGORY_COLORS: Record<BudgetCategory, string> = {
  materials: '#5e8d87',
  labor: '#c08457',
  permits: '#7a7fb0',
  fixtures: '#cfa83e',
  other: '#9aa0a6',
}

export interface RoomBudget {
  /** Σ estimateCents across the room's lines — the planned spend. */
  estimateCents: number
  /** Σ (actualCents ?? 0) — what's actually been spent so far. */
  actualCents: number
  /** Signed: Σ(actual − estimate) over lines that have an actual. >0 = over. */
  varianceCents: number
  /** estimate − actual; what's left of the room's own estimate. */
  remainingCents: number
  /** A room is over budget when recorded spend exceeds its estimate. */
  overBudget: boolean
  lineCount: number
}

export function roomBudget(lines: BudgetLineLike[]): RoomBudget {
  let estimateCents = 0
  let actualCents = 0
  let varianceCents = 0
  for (const l of lines) {
    estimateCents += l.estimateCents
    if (l.actualCents != null) {
      actualCents += l.actualCents
      varianceCents += l.actualCents - l.estimateCents
    }
  }
  return {
    estimateCents,
    actualCents,
    varianceCents,
    remainingCents: estimateCents - actualCents,
    overBudget: actualCents > estimateCents,
    lineCount: lines.length,
  }
}

export interface ProjectBudget {
  totalBudgetCents: number
  /** Σ estimateCents across every line in the project. */
  committedCents: number
  /** Σ actualCents across the project. */
  actualCents: number
  /** round(committed × contingencyPct/100) — the planning-fallacy buffer. */
  contingencyCents: number
  /** committed + contingency — the protected commitment. */
  committedWithContingencyCents: number
  /** totalBudget − committed; what's still unallocated. Lead with this (UX7). */
  remainingCents: number
  /** Signed project variance: Σ over rooms of varianceCents. */
  varianceCents: number
  /** Estimates already exceed the budget (before contingency). */
  overBudget: boolean
}

export function projectBudget(
  lines: BudgetLineLike[],
  totalBudgetCents: number,
  contingencyPct: number,
): ProjectBudget {
  let committedCents = 0
  let actualCents = 0
  let varianceCents = 0
  for (const l of lines) {
    committedCents += l.estimateCents
    if (l.actualCents != null) {
      actualCents += l.actualCents
      varianceCents += l.actualCents - l.estimateCents
    }
  }
  // Integer-cents contingency: round half-up on the cent.
  const contingencyCents = Math.round((committedCents * contingencyPct) / 100)
  return {
    totalBudgetCents,
    committedCents,
    actualCents,
    contingencyCents,
    committedWithContingencyCents: committedCents + contingencyCents,
    remainingCents: totalBudgetCents - committedCents,
    varianceCents,
    overBudget: committedCents > totalBudgetCents,
  }
}

// Category totals across a set of lines (project donut + room breakdown). Every
// category is present (zero when unused) so the chart legend is stable.
export function categoryBreakdown(
  lines: BudgetLineLike[],
): Record<BudgetCategory, { estimateCents: number, actualCents: number }> {
  const out = {} as Record<BudgetCategory, { estimateCents: number, actualCents: number }>
  for (const c of BUDGET_CATEGORIES) out[c] = { estimateCents: 0, actualCents: 0 }
  for (const l of lines) {
    out[l.category].estimateCents += l.estimateCents
    if (l.actualCents != null) out[l.category].actualCents += l.actualCents
  }
  return out
}

// Per-room estimate totals, in room order, for the stacked bar.
export function estimateByRoom(
  lines: BudgetLineLike[],
  roomIds: string[],
): Record<string, Record<BudgetCategory, number>> {
  const out: Record<string, Record<BudgetCategory, number>> = {}
  for (const id of roomIds) {
    out[id] = {} as Record<BudgetCategory, number>
    for (const c of BUDGET_CATEGORIES) out[id]![c] = 0
  }
  for (const l of lines) {
    if (!out[l.roomId]) continue
    out[l.roomId]![l.category] += l.estimateCents
  }
  return out
}

// UX12 (anchoring): typical 2026 US remodel cost ranges in integer cents per
// room type + category, shown as the estimate field's placeholder so estimates
// anchor on realistic numbers rather than at zero. Not authoritative — a
// starting frame. Categories absent from a room type fall back to a generic
// range; 'other' is intentionally un-anchored.
type Range = readonly [lowCents: number, highCents: number]
const D = (lowDollars: number, highDollars: number): Range => [lowDollars * 100, highDollars * 100]

const GENERIC: Partial<Record<BudgetCategory, Range>> = {
  materials: D(1000, 6000),
  labor: D(800, 4000),
  fixtures: D(500, 3000),
  permits: D(150, 700),
}

const COST_RANGES: Partial<Record<RoomType, Partial<Record<BudgetCategory, Range>>>> = {
  'kitchen': { materials: D(8000, 25000), labor: D(5000, 15000), fixtures: D(3000, 12000), permits: D(250, 900) },
  'bathroom': { materials: D(3000, 12000), labor: D(3000, 10000), fixtures: D(1500, 6000), permits: D(200, 700) },
  'bedroom': { materials: D(1500, 6000), labor: D(1000, 4000), fixtures: D(400, 2000), permits: D(150, 400) },
  'living-room': { materials: D(2000, 9000), labor: D(1500, 6000), fixtures: D(600, 3500), permits: D(150, 500) },
  'dining-room': { materials: D(1500, 7000), labor: D(1200, 5000), fixtures: D(800, 4000), permits: D(150, 400) },
  'home-office': { materials: D(1500, 7000), labor: D(1000, 4500), fixtures: D(500, 3000), permits: D(150, 500) },
  'laundry-utility': { materials: D(1500, 7000), labor: D(1500, 6000), fixtures: D(800, 4000), permits: D(200, 700) },
  'mudroom-entry': { materials: D(1000, 5000), labor: D(800, 3500), fixtures: D(300, 1800), permits: D(150, 400) },
  'hallway-stairs': { materials: D(800, 4500), labor: D(800, 4000), fixtures: D(300, 1500), permits: D(150, 500) },
  'garage': { materials: D(2000, 10000), labor: D(1500, 6000), fixtures: D(500, 3000), permits: D(200, 800) },
  'exterior': { materials: D(3000, 20000), labor: D(3000, 15000), fixtures: D(500, 4000), permits: D(200, 900) },
}

export function typicalRange(type: RoomType, category: BudgetCategory): Range | null {
  return COST_RANGES[type]?.[category] ?? GENERIC[category] ?? null
}
