import { z } from 'zod'
import { FirestoreTimestamp, OwnerScoped } from './common'
import { PhotoStage } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/photos/{photoId}
export const Photo = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  storagePath: z.string().min(1),
  thumbPath: z.string().min(1),
  stage: PhotoStage,
  caption: z.string().optional(),
  takenAt: FirestoreTimestamp,
  taskId: z.string().optional(),
  selectionId: z.string().optional(),
  // Soft-delete flag; a client sweep purges these after 24h (Build Conventions).
  deletedAt: FirestoreTimestamp.optional(),
})
export type Photo = z.infer<typeof Photo>
