import { z } from 'zod'
import { Cents, DateOnly, FirestoreTimestamp, OwnerScoped } from './common'
import { SelectionStatus } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/selections/{selectionId}
// orderedAt (event) + leadTimeDays computes expectedAt (a calendar date).
export const Selection = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1),
  vendor: z.string().optional(),
  sku: z.string().optional(),
  url: z.string().url().optional(),
  priceCents: Cents.optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  status: SelectionStatus.default('considering'),
  orderedAt: FirestoreTimestamp.optional(),
  expectedAt: DateOnly.optional(),
  budgetLineId: z.string().optional(),
})
export type Selection = z.infer<typeof Selection>
