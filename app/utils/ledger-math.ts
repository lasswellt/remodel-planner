import type { BudgetCategory } from '~/models'
import { BudgetCategory as BudgetCategoryEnum } from '~/models'

// THE spending-ledger math source (Build Conventions: money is integer cents,
// no float arithmetic). Pure over plain arrays so the room ledger section, the
// budget "Spent (actual)" rollup, and unit tests all agree. Distinct from
// budget-math.ts: that totals estimates; this totals what was actually spent.
// Formatting to dollars happens only at the render boundary via utils/money.ts.

export interface ExpenseLike {
  roomId: string
  category: BudgetCategory
  amountCents: number
}

const CATEGORIES: readonly BudgetCategory[] = BudgetCategoryEnum.options

export interface LedgerSummary {
  /** Σ amountCents across the given expenses — total spent. */
  totalCents: number
  count: number
  /** Per-category spend; every category present (zero when unused) so legends
      and rollups stay stable. */
  byCategory: Record<BudgetCategory, number>
}

export function ledgerSummary(expenses: ExpenseLike[]): LedgerSummary {
  const byCategory = {} as Record<BudgetCategory, number>
  for (const c of CATEGORIES) byCategory[c] = 0
  let totalCents = 0
  for (const e of expenses) {
    totalCents += e.amountCents
    byCategory[e.category] += e.amountCents
  }
  return { totalCents, count: expenses.length, byCategory }
}

// Per-room spend totals, in room order — the budget page's per-room "Spent"
// column. Unknown rooms (e.g. an expense on a since-deleted room) are ignored.
export function spentByRoom(
  expenses: ExpenseLike[],
  roomIds: string[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of roomIds) out[id] = 0
  for (const e of expenses) {
    if (e.roomId in out) out[e.roomId]! += e.amountCents
  }
  return out
}
