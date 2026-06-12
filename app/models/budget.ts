import { z } from 'zod'
import { Cents, OwnerScoped } from './common'
import { BudgetCategory } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/budgetLines/{lineId}
export const BudgetLine = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  label: z.string().min(1),
  category: BudgetCategory,
  estimateCents: Cents,
  actualCents: Cents.optional(),
  vendor: z.string().optional(),
  link: z.string().url().optional(),
})
export type BudgetLine = z.infer<typeof BudgetLine>
