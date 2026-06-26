import { z } from 'zod'
import { Cents, DateOnly, OwnerScoped } from './common'
import { BudgetCategory } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/expenses/{expenseId}
//
// A spending-ledger entry: a dated record of money actually spent on a room.
// Distinct from a BudgetLine (an estimate) — a budget line is one planned row
// with a single optional `actualCents`, whereas a room accrues many ledger
// entries over the job (every Home Depot run, each contractor draw). Reuses the
// BudgetCategory enum so ledger spend rolls up against the same categories the
// budget estimates by.
export const Expense = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  label: z.string().min(1),
  category: BudgetCategory,
  amountCents: Cents,
  // The calendar date the money was spent (YYYY-MM-DD, no timezone math).
  date: DateOnly,
  vendor: z.string().optional(),
  note: z.string().optional(),
  link: z.string().url().optional(),
})
export type Expense = z.infer<typeof Expense>
