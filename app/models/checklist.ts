import { z } from 'zod'
import { OwnerScoped } from './common'

// users/{uid}/projects/{projectId}/rooms/{roomId}/checklist/{itemId}
export const ChecklistItem = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1),
  done: z.boolean().default(false),
  fromTemplate: z.boolean().default(false),
  // Cross-links to a design-psychology.md slug for the info popover (UX5).
  psychologyTag: z.string().optional(),
  notes: z.string().optional(),
})
export type ChecklistItem = z.infer<typeof ChecklistItem>
