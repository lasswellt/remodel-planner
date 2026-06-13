import type { RoomTemplate } from './types'

// Living spaces: bedroom, living room, dining room, home office.

export const bedroom: RoomTemplate = {
  type: 'bedroom',
  checklist: [
    { label: 'Paint colors (rest-supporting)', category: 'Surfaces', psychologyTag: 'color-psychology' },
    { label: 'Flooring', category: 'Flooring', psychologyTag: 'texture-material-warmth' },
    { label: 'Lighting & dimmers', category: 'Lighting', psychologyTag: 'lighting-circadian' },
    { label: 'Window treatments / blackout', category: 'Comfort', psychologyTag: 'lighting-circadian' },
    { label: 'Outlets & USB', category: 'Electrical' },
    { label: 'Ceiling fan', category: 'Comfort' },
    { label: 'Closet system', category: 'Storage', psychologyTag: 'clutter-cognitive-load' },
  ],
  tasks: [
    { key: 'demo', label: 'Prep & demo old finishes', phase: 'demo' },
    { key: 'elec', label: 'Electrical rough-in (dimmers, outlets, fan box)', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'drywall', label: 'Drywall repair', phase: 'drywall', dependsOn: ['elec'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['drywall'] },
    { key: 'floor', label: 'Install flooring', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'closet', label: 'Install closet system', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'fixtures', label: 'Hang fan, treatments & plates', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'punch', label: 'Punch list', phase: 'punch-list', dependsOn: ['closet', 'fixtures'] },
  ],
}

export const livingRoom: RoomTemplate = {
  type: 'living-room',
  checklist: [
    { label: 'Seating layout & sightlines', category: 'Layout', psychologyTag: 'spatial-flow-prospect-refuge' },
    { label: 'Paint colors (gathering-warm)', category: 'Surfaces', psychologyTag: 'color-psychology' },
    { label: 'Fireplace surround', category: 'Surfaces', psychologyTag: 'texture-material-warmth' },
    { label: 'Flooring', category: 'Flooring' },
    { label: 'Lighting layers — ambient / task / accent', category: 'Lighting', psychologyTag: 'lighting-circadian' },
    { label: 'Media & cable management', category: 'Electrical', psychologyTag: 'clutter-cognitive-load' },
    { label: 'Built-ins', category: 'Storage', psychologyTag: 'clutter-cognitive-load' },
    { label: 'Plants & natural-light plan', category: 'Comfort', psychologyTag: 'biophilic-design' },
  ],
  tasks: [
    { key: 'demo', label: 'Prep & demo', phase: 'demo' },
    { key: 'elec', label: 'Electrical rough-in (lighting, media)', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'drywall', label: 'Drywall repair', phase: 'drywall', dependsOn: ['elec'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['drywall'] },
    { key: 'floor', label: 'Install flooring', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'builtins', label: 'Install built-ins & surround', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'punch', label: 'Fixtures, media & punch list', phase: 'punch-list', dependsOn: ['builtins'] },
  ],
}

export const diningRoom: RoomTemplate = {
  type: 'dining-room',
  checklist: [
    { label: 'Table zone & circulation', category: 'Layout', psychologyTag: 'spatial-flow-prospect-refuge' },
    { label: 'Paint colors', category: 'Surfaces', psychologyTag: 'color-psychology' },
    { label: 'Wainscoting & trim', category: 'Surfaces', psychologyTag: 'texture-material-warmth' },
    { label: 'Flooring', category: 'Flooring' },
    { label: 'Chandelier height & sizing', category: 'Lighting', psychologyTag: 'ceiling-height-volume' },
  ],
  tasks: [
    { key: 'demo', label: 'Prep & demo', phase: 'demo' },
    { key: 'elec', label: 'Chandelier box & dimmer rough-in', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['elec'] },
    { key: 'floor', label: 'Install flooring', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'trim', label: 'Wainscoting & trim install', phase: 'trim', dependsOn: ['floor'] },
    { key: 'light', label: 'Hang & level chandelier', phase: 'fixtures', dependsOn: ['trim'] },
    { key: 'punch', label: 'Punch list', phase: 'punch-list', dependsOn: ['light'] },
  ],
}

export const homeOffice: RoomTemplate = {
  type: 'home-office',
  checklist: [
    { label: 'Desk orientation & window view', category: 'Layout', psychologyTag: 'biophilic-design' },
    { label: 'Paint colors (focus-supporting)', category: 'Surfaces', psychologyTag: 'color-psychology' },
    { label: 'Task + ambient lighting', category: 'Lighting', psychologyTag: 'lighting-circadian' },
    { label: 'Outlet plan', category: 'Electrical' },
    { label: 'Network drops', category: 'Electrical' },
    { label: 'Built-in desk & shelving', category: 'Storage', psychologyTag: 'clutter-cognitive-load' },
    { label: 'Acoustic treatment', category: 'Comfort', psychologyTag: 'acoustic-comfort' },
  ],
  tasks: [
    { key: 'demo', label: 'Prep & demo', phase: 'demo' },
    { key: 'elec', label: 'Electrical + low-voltage rough-in', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'drywall', label: 'Drywall repair & acoustic backing', phase: 'drywall', dependsOn: ['elec'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['drywall'] },
    { key: 'floor', label: 'Install flooring', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'builtins', label: 'Install desk & shelving', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'punch', label: 'Acoustic panels & punch list', phase: 'punch-list', dependsOn: ['builtins'] },
  ],
}
