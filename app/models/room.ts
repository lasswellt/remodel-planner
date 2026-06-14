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

// The four walls of the axis-aligned footprint.
export const WallSide = z.enum(['n', 's', 'e', 'w'])
export type WallSide = z.infer<typeof WallSide>

// Per-wall thickness in inches. Default 0 → no wall band is drawn and the
// usable interior equals the footprint, so plans created before walls existed
// render unchanged. Exterior walls run ~5–8", interior partitions ~4.5".
export const Walls = z.object({
  n: z.number().nonnegative(),
  s: z.number().nonnegative(),
  e: z.number().nonnegative(),
  w: z.number().nonnegative(),
})
export type Walls = z.infer<typeof Walls>

// Whether the footprint dimensions are shown/entered as the finished interior
// or the structural exterior. The stored footprint (x/y/w/h) is ALWAYS the
// exterior; basis only changes how dimensions are displayed and parsed.
export const DimensionBasis = z.enum(['interior', 'exterior'])
export type DimensionBasis = z.infer<typeof DimensionBasis>

// ---- openings (doors / windows) ----

export const OpeningKind = z.enum(['door', 'window'])
export type OpeningKind = z.infer<typeof OpeningKind>

// Door leaf style. 'cased-opening' is a wall gap with no leaf.
export const DoorType = z.enum([
  'single',
  'double',
  'sliding',
  'pocket',
  'bifold',
  'cased-opening',
])
export type DoorType = z.infer<typeof DoorType>

// Hinge side relative to the wall's start→end axis (n/s run W→E, e/w run N→S).
export const HingeSide = z.enum(['left', 'right'])
export type HingeSide = z.infer<typeof HingeSide>

// Swing relative to the room: 'in' opens toward the interior, 'out' away.
export const SwingDir = z.enum(['in', 'out'])
export type SwingDir = z.infer<typeof SwingDir>

// An opening anchored to a wall, positioned by `offset` (inches from the wall's
// start corner) and `width` along that wall. Stored on geometry so it travels
// with the room. Door fields (doorType/hinge/swing) and window fields
// (sill/height) are optional and only meaningful for the matching kind.
export const Opening = z.object({
  id: z.string().min(1),
  kind: OpeningKind,
  wall: WallSide,
  offset: z.number().nonnegative(),
  width: z.number().positive(),
  // door
  doorType: DoorType.optional(),
  hinge: HingeSide.optional(),
  swing: SwingDir.optional(),
  // window
  sill: z.number().nonnegative().optional(),
  height: z.number().positive().optional(),
})
export type Opening = z.infer<typeof Opening>

// ---- fixtures (obstructions) ----

export const FixtureKind = z.enum([
  'tub',
  'shower',
  'toilet',
  'sink',
  'vanity',
  'fridge',
  'range',
  'dishwasher',
  'washer',
  'dryer',
  'island',
  'water-heater',
  'generic',
])
export type FixtureKind = z.infer<typeof FixtureKind>

// A fixture / obstruction placed inside the room, stored relative to the room
// origin (like a notch) so it moves with the room. Fixtures sit on top of the
// floor — they do NOT subtract floor area. `rotation` is a 0/90/180/270 step.
export const Fixture = z.object({
  id: z.string().min(1),
  kind: FixtureKind,
  label: z.string().optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
})
export type Fixture = z.infer<typeof Fixture>

export const Geometry = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
  notches: z.array(Notch).default([]),
  walls: Walls.default({ n: 0, s: 0, e: 0, w: 0 }),
  basis: DimensionBasis.default('exterior'),
  openings: z.array(Opening).default([]),
  fixtures: z.array(Fixture).default([]),
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
  // Stacking order on the plan. Higher = on top; an overlapping higher room
  // bites a (non-destructive) notch out of any lower room it covers. Default 0;
  // grabbing a room to move it brings it to the front.
  z: z.number().default(0),
})
export type Room = z.infer<typeof Room>
