import { z } from 'zod'
import { Timestamp } from 'firebase/firestore'

// Money is integer cents everywhere (Standing Rule 5). No float currency math.
export const Cents = z.number().int().nonnegative()

// A date a human picked off a calendar — stored as a YYYY-MM-DD string, no
// timezone math (Build Conventions). Event timestamps use Firestore Timestamp.
export const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
export type DateOnly = z.infer<typeof DateOnly>

// Firestore Timestamp passthrough — validated as an instance, not reshaped.
export const FirestoreTimestamp = z.instanceof(Timestamp)

// Every document denormalizes its owner uid and projectId so project-wide
// collection-group queries (all blocked tasks, overdue selections) work and
// can be authorized by a single rule (Build Conventions).
export const OwnerScoped = z.object({
  uid: z.string().min(1),
  projectId: z.string().min(1),
})

// Current export/import schema version. Import refuses newer versions and
// migrates older ones (Build Conventions).
export const SCHEMA_VERSION = 1
