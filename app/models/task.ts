import { z } from 'zod'
import { DateOnly, OwnerScoped } from './common'
import { TaskPhase, TaskStatus } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/tasks/{taskId}
export const Task = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  label: z.string().min(1),
  phase: TaskPhase,
  status: TaskStatus.default('todo'),
  dependsOn: z.array(z.string()).default([]),
  blockedBySelections: z.array(z.string()).default([]),
  dueDate: DateOnly.optional(),
  notes: z.string().optional(),
})
export type Task = z.infer<typeof Task>
