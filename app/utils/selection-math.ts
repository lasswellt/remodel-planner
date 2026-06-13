import type { Timestamp } from 'firebase/firestore'
import type { RoomType } from '~/models'

// Pure selection scheduling math (Phase 8). Lead times are the top remodel
// schedule killer, so expectedAt is derived deterministically from the order
// event + lead time and unit-tested.

// orderedAt (a Firestore event Timestamp) + leadTimeDays → expectedAt, a
// calendar date (YYYY-MM-DD). UTC date components so the result is stable and
// timezone-free, matching the DateOnly convention.
export function computeExpectedAt(orderedAt: Timestamp, leadTimeDays: number): string {
  const ms = orderedAt.toMillis() + leadTimeDays * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

const ARRIVED: ReadonlySet<string> = new Set(['delivered', 'installed'])

// Overdue = has an expected date in the past and hasn't physically arrived.
// String comparison is correct for zero-padded YYYY-MM-DD.
export function isOverdue(
  expectedAt: string | undefined,
  status: string,
  today: string,
): boolean {
  if (!expectedAt || ARRIVED.has(status)) return false
  return expectedAt < today
}

export function hasArrived(status: string): boolean {
  return ARRIVED.has(status)
}

// Today's calendar date in the local zone (the user's "today" for overdue).
export function todayDateOnly(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// UX10: common long-lead items per room type, suggested when a room's selection
// list is empty so the user starts ordering the schedule-critical things early.
export const LONG_LEAD_SUGGESTIONS: Record<RoomType, string[]> = {
  'kitchen': ['Cabinets', 'Appliances', 'Countertop slab', 'Range hood', 'Tile backsplash'],
  'bathroom': ['Vanity', 'Shower glass enclosure', 'Tile', 'Soaking tub', 'Plumbing fixtures'],
  'bedroom': ['Closet system', 'Light fixtures', 'Window treatments', 'Ceiling fan'],
  'living-room': ['Built-in millwork', 'Fireplace surround', 'Light fixtures', 'Flooring'],
  'dining-room': ['Chandelier', 'Wainscoting / trim', 'Flooring'],
  'home-office': ['Built-in desk / shelving', 'Task + ambient lighting', 'Acoustic panels'],
  'laundry-utility': ['Washer / dryer', 'Utility sink', 'Cabinetry', 'Countertop'],
  'mudroom-entry': ['Built-in bench / lockers', 'Durable flooring', 'Light fixtures'],
  'hallway-stairs': ['Stair treads / risers', 'Handrail', 'Runner / flooring', 'Light fixtures'],
  'garage': ['Epoxy floor kit', 'Storage / cabinet system', 'EV charger', 'Insulation'],
  'exterior': ['Siding', 'Windows', 'Exterior doors', 'Gutters', 'Light fixtures'],
}
