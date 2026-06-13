import { z } from 'zod'
import { Cents, OwnerScoped } from './common'
import { PurchaseStatus } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/purchases/{purchaseId}
// A thing to buy (or an idea for one), grouped by kind (Vanities, Tubs, Couches,
// …) and star-ranked within its group so favorites float to the top.
export const PurchaseItem = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  title: z.string().min(1),
  group: z.string().min(1),
  status: PurchaseStatus.default('idea'),
  rank: z.number().int().min(0).max(5).default(0),
  vendor: z.string().optional(),
  url: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  priceCents: Cents.optional(),
  notes: z.string().optional(),
})
export type PurchaseItem = z.infer<typeof PurchaseItem>
