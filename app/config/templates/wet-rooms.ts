import type { RoomTemplate } from './types'

// Wet rooms: kitchen, bathroom, laundry/utility. Template coverage follows
// the Phase 5 spec table verbatim; psychologyTags link into the Phase 1
// design-psychology corpus.

export const kitchen: RoomTemplate = {
  type: 'kitchen',
  checklist: [
    { label: 'Island / breakfast seating & sightlines', category: 'Layout', psychologyTag: 'spatial-flow-prospect-refuge' },
    { label: 'Paint colors', category: 'Surfaces', psychologyTag: 'color-psychology' },
    { label: 'Countertops', category: 'Surfaces', psychologyTag: 'texture-material-warmth' },
    { label: 'Backsplash', category: 'Surfaces' },
    { label: 'Flooring', category: 'Flooring' },
    { label: 'Lighting layers — ambient / task / accent', category: 'Lighting', psychologyTag: 'lighting-circadian' },
    { label: 'GFCI & outlet count', category: 'Electrical' },
    { label: 'Sink & faucet', category: 'Plumbing' },
    { label: 'Ventilation / range hood', category: 'Ventilation' },
    { label: 'Appliances', category: 'Appliances' },
    { label: 'Cabinets & closed storage', category: 'Storage', psychologyTag: 'clutter-cognitive-load' },
  ],
  tasks: [
    { key: 'demo', label: 'Demo cabinets, counters & old finishes', phase: 'demo' },
    { key: 'plumb', label: 'Plumbing rough-in updates', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'elec', label: 'Electrical rough-in (GFCI, lighting circuits)', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'drywall', label: 'Drywall patch & finish', phase: 'drywall', dependsOn: ['plumb', 'elec'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['drywall'] },
    { key: 'floor', label: 'Install flooring', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'cabinets', label: 'Install cabinets', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'counters', label: 'Template & install counters + backsplash', phase: 'fixtures', dependsOn: ['cabinets'] },
    { key: 'punch', label: 'Appliances, hardware & punch list', phase: 'punch-list', dependsOn: ['counters'] },
  ],
}

export const bathroom: RoomTemplate = {
  type: 'bathroom',
  checklist: [
    { label: 'Tub / shower', category: 'Fixtures', psychologyTag: 'bathroom-as-retreat' },
    { label: 'Vanity', category: 'Fixtures' },
    { label: 'Toilet', category: 'Fixtures' },
    { label: 'Tile', category: 'Surfaces', psychologyTag: 'texture-material-warmth' },
    { label: 'Waterproofing membrane', category: 'Surfaces' },
    { label: 'Heated floor option', category: 'Comfort', psychologyTag: 'bathroom-as-retreat' },
    { label: 'Lighting (vanity + ambient)', category: 'Lighting', psychologyTag: 'lighting-circadian' },
    { label: 'GFCI protection', category: 'Safety' },
    { label: 'Water shutoffs', category: 'Plumbing' },
    { label: 'Exhaust fan', category: 'Ventilation' },
  ],
  tasks: [
    { key: 'demo', label: 'Demo fixtures & finishes', phase: 'demo' },
    { key: 'plumb', label: 'Plumbing rough-in', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'elec', label: 'Electrical rough-in (GFCI, fan, vanity)', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'board', label: 'Cement board + waterproofing membrane', phase: 'drywall', dependsOn: ['plumb', 'elec'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['board'] },
    { key: 'tile', label: 'Tile floor & walls', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'set', label: 'Set vanity, toilet & trim fixtures', phase: 'fixtures', dependsOn: ['tile'] },
    { key: 'punch', label: 'Caulk, accessories & punch list', phase: 'punch-list', dependsOn: ['set'] },
  ],
}

export const laundryUtility: RoomTemplate = {
  type: 'laundry-utility',
  checklist: [
    { label: 'Water-resistant flooring', category: 'Flooring' },
    { label: 'Washer / dryer hookups', category: 'Plumbing' },
    { label: 'Drain pan', category: 'Plumbing' },
    { label: 'Dryer venting', category: 'Ventilation' },
    { label: 'Folding counter', category: 'Surfaces' },
    { label: 'Storage & shelving', category: 'Storage', psychologyTag: 'clutter-cognitive-load' },
    { label: 'Sound isolation from living spaces', category: 'Comfort', psychologyTag: 'acoustic-comfort' },
    { label: 'Leak sensor placement', category: 'Safety' },
  ],
  tasks: [
    { key: 'demo', label: 'Demo & prep', phase: 'demo' },
    { key: 'plumb', label: 'Hookups + drain pan rough-in', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'vent', label: 'Dryer vent & electrical', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'drywall', label: 'Drywall patch & sound insulation', phase: 'drywall', dependsOn: ['plumb', 'vent'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['drywall'] },
    { key: 'floor', label: 'Install water-resistant flooring', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'install', label: 'Set machines, counter & storage', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'punch', label: 'Leak sensors & punch list', phase: 'punch-list', dependsOn: ['install'] },
  ],
}
