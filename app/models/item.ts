import { z } from 'zod'
import { Cents, DateOnly, FirestoreTimestamp, OwnerScoped } from './common'
import { ItemStatus } from './enums'

// users/{uid}/projects/{projectId}/rooms/{roomId}/items/{itemId}
//
// The unified "thing to buy + install" — merges the former Shopping (purchases)
// and Selections collections into one continuous lifecycle. An item is browsed
// and ranked as an idea, committed to ('to-buy'), purchased (order placed —
// orderedAt stamped, expectedAt derived from leadTimeDays), then delivered and
// installed. Discovery-flavored fields (rank, image, notes) and procurement
// fields (sku, leadTimeDays, orderedAt/expectedAt, budgetLineId) are all optional
// so an item carries only what its current phase needs.
export const Item = OwnerScoped.extend({
  id: z.string().min(1),
  roomId: z.string().min(1),
  label: z.string().min(1),
  // Free-text grouping bucket (e.g. 'Vanities', 'Cabinets'). Optional — items
  // captured from a long-lead suggestion may not set one.
  category: z.string().optional(),
  status: ItemStatus.default('idea'),
  // Star rank 0–5 for comparing options while shopping. Optional (only set while
  // an item is still a candidate); absent ranks sort as 0.
  rank: z.number().int().min(0).max(5).optional(),
  vendor: z.string().optional(),
  sku: z.string().optional(),
  url: z.string().url().optional(),
  notes: z.string().optional(),
  priceCents: Cents.optional(),
  // Uploaded item photo (imagePath = Storage path, cleaned up on delete) vs an
  // external imageUrl scraped from a product page.
  imageUrl: z.string().url().optional(),
  imagePath: z.string().optional(),
  // Receipt (a photo or PDF in Storage), relevant once purchased. receiptType is
  // the content type so the UI can show a PDF-vs-image affordance.
  receiptUrl: z.string().url().optional(),
  receiptPath: z.string().optional(),
  receiptType: z.string().optional(),
  // Procurement / scheduling: orderedAt (event) + leadTimeDays → expectedAt (a
  // calendar date). Stamped when the item advances to 'purchased'.
  leadTimeDays: z.number().int().nonnegative().optional(),
  orderedAt: FirestoreTimestamp.optional(),
  expectedAt: DateOnly.optional(),
  budgetLineId: z.string().optional(),
})
export type Item = z.infer<typeof Item>
