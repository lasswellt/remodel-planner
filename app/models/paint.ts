import { z } from 'zod'
import { OwnerScoped } from './common'
import { PaintFinish, PaintSurface } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/paints/{paintId}
// A chosen paint color — the can-label facts (brand + code), the finish/sheen,
// the surface it's for, and an optional hex for the on-screen swatch.
export const Paint = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  code: z.string().optional(),
  finish: PaintFinish.optional(),
  surface: PaintSurface.optional(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB').optional(),
  notes: z.string().optional(),
})
export type Paint = z.infer<typeof Paint>
