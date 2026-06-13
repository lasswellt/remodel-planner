import type { RoomType } from '~/models'
import type { RoomTemplate } from './types'
import { bathroom, kitchen, laundryUtility } from './wet-rooms'
import { bedroom, diningRoom, homeOffice, livingRoom } from './living-spaces'
import { exterior, garage, hallwayStairs, mudroomEntry } from './circulation-exterior'

export * from './types'

// One template per room type — completeness enforced by the Record type and
// asserted against the corpus in tests/templates.test.ts.
export const ROOM_TEMPLATES: Record<RoomType, RoomTemplate> = {
  'kitchen': kitchen,
  'bathroom': bathroom,
  'bedroom': bedroom,
  'living-room': livingRoom,
  'dining-room': diningRoom,
  'home-office': homeOffice,
  'laundry-utility': laundryUtility,
  'mudroom-entry': mudroomEntry,
  'hallway-stairs': hallwayStairs,
  'garage': garage,
  'exterior': exterior,
}
