import { z } from 'zod'
import { Cents, DateOnly, OwnerScoped } from './common'
import { InspectionStatus, PermitStatus, TaskPhase } from './enums'

// Embedded in a Permit. gatePhase ties an inspection to the remodel phase it
// must clear before later-phase tasks in affected rooms can start (Phase 7/9).
export const Inspection = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  gatePhase: TaskPhase,
  status: InspectionStatus.default('pending'),
  scheduledAt: DateOnly.optional(),
  resultNotes: z.string().optional(),
})
export type Inspection = z.infer<typeof Inspection>

// users/{uid}/projects/{projectId}/permits/{permitId}
export const Permit = OwnerScoped.extend({
  id: z.string().min(1),
  scope: z.string().min(1),
  authority: z.string().default('Cobb County'),
  permitNumber: z.string().optional(),
  status: PermitStatus.default('needed'),
  feeCents: Cents.optional(),
  appliedAt: DateOnly.optional(),
  issuedAt: DateOnly.optional(),
  inspections: z.array(Inspection).default([]),
})
export type Permit = z.infer<typeof Permit>
