import { z } from 'zod'
import { OwnerScoped } from './common'
import { RoomStatus, RoomType } from './enums'

export const Geometry = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
})
export type Geometry = z.infer<typeof Geometry>

// users/{uid}/projects/{projectId}/rooms/{roomId}
export const Room = OwnerScoped.extend({
  id: z.string().min(1),
  name: z.string().min(1),
  type: RoomType,
  floor: z.number().int(),
  geometry: Geometry,
  status: RoomStatus.default('planned'),
})
export type Room = z.infer<typeof Room>
