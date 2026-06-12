import type { RoomType } from '~/models'
import { RoomType as RoomTypeEnum } from '~/models'

// Display names + icons for room types, shared by the create dialog, summary
// panel, and (Phase 5) the rooms page. Slugs are the enum values.
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  'kitchen': 'Kitchen',
  'bathroom': 'Bathroom',
  'bedroom': 'Bedroom',
  'living-room': 'Living room',
  'dining-room': 'Dining room',
  'home-office': 'Home office',
  'laundry-utility': 'Laundry / utility',
  'mudroom-entry': 'Mudroom / entry',
  'hallway-stairs': 'Hallway / stairs',
  'garage': 'Garage',
  'exterior': 'Exterior',
}

export const ROOM_TYPE_ICONS: Record<RoomType, string> = {
  'kitchen': 'mdi-countertop-outline',
  'bathroom': 'mdi-shower',
  'bedroom': 'mdi-bed-outline',
  'living-room': 'mdi-sofa-outline',
  'dining-room': 'mdi-silverware-fork-knife',
  'home-office': 'mdi-desk',
  'laundry-utility': 'mdi-washing-machine',
  'mudroom-entry': 'mdi-door-open',
  'hallway-stairs': 'mdi-stairs',
  'garage': 'mdi-garage-open-variant',
  'exterior': 'mdi-home-roof',
}

export const ROOM_TYPE_OPTIONS = RoomTypeEnum.options.map(value => ({
  value,
  title: ROOM_TYPE_LABELS[value],
  icon: ROOM_TYPE_ICONS[value],
}))
