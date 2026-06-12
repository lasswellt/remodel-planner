import { z } from 'zod'
import { OwnerScoped } from './common'
import { RoomType } from './enums'

// users/{uid}/projects/{projectId}/inspiration/{itemId}
// Either pinned to a specific room or general to a room type.
export const InspirationItem = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().optional(),
  roomType: RoomType.optional(),
  title: z.string().min(1),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  notes: z.string().optional(),
  psychologyTags: z.array(z.string()).default([]),
})
export type InspirationItem = z.infer<typeof InspirationItem>
