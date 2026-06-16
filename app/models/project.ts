import { z } from 'zod'
import { Cents, FirestoreTimestamp } from './common'

// users/{uid}/projects/{projectId}
export const Project = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  totalBudgetCents: Cents,
  contingencyPct: z.number().min(0).max(100).default(15),
  createdAt: FirestoreTimestamp,
  // Set once the one-time selections+purchases → items migration has run for
  // this project (see utils/items-migration). Gates the idempotent migration.
  itemsMigratedAt: FirestoreTimestamp.optional(),
})
export type Project = z.infer<typeof Project>
