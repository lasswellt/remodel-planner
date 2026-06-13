import type { RoomType } from '~/models'

// A representative design-psychology slug per room type, attached to seeded
// inspiration items so each card cross-links to the research that explains why
// the idea matters (the Phase 11 tag round-trip). Slugs match the
// content/research/design-psychology.md corpus.
export const ROOM_TYPE_PSYCHOLOGY: Record<RoomType, string[]> = {
  'kitchen': ['spatial-flow-prospect-refuge'],
  'bathroom': ['bathroom-as-retreat'],
  'bedroom': ['lighting-circadian'],
  'living-room': ['biophilic-design'],
  'dining-room': ['lighting-circadian'],
  'home-office': ['acoustic-comfort'],
  'laundry-utility': ['clutter-cognitive-load'],
  'mudroom-entry': ['entry-sequence-transitions'],
  'hallway-stairs': ['entry-sequence-transitions'],
  'garage': ['clutter-cognitive-load'],
  'exterior': ['biophilic-design'],
}
