import { z } from 'zod'
import { OwnerScoped } from './common'
import { RoomStatus, RoomType } from './enums'

// A rectangular cutout stored relative to the room's (x, y) origin.
// Rooms move → notches move with them automatically (no coordinate fixup needed).
export const Notch = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
})
export type Notch = z.infer<typeof Notch>

export const Geometry = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
  notches: z.array(Notch).default([]),
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
