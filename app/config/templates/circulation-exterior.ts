import type { RoomTemplate } from './types'

// Circulation + utility shells: mudroom/entry, hallway/stairs, garage, exterior.

export const mudroomEntry: RoomTemplate = {
  type: 'mudroom-entry',
  checklist: [
    { label: 'Drop zone', category: 'Layout', psychologyTag: 'entry-sequence-transitions' },
    { label: 'Bench & hooks', category: 'Storage', psychologyTag: 'entry-sequence-transitions' },
    { label: 'Cubbies / closed clutter storage', category: 'Storage', psychologyTag: 'clutter-cognitive-load' },
    { label: 'Durable flooring', category: 'Flooring', psychologyTag: 'texture-material-warmth' },
    { label: 'Lighting', category: 'Lighting', psychologyTag: 'lighting-circadian' },
  ],
  tasks: [
    { key: 'demo', label: 'Prep & demo', phase: 'demo' },
    { key: 'elec', label: 'Lighting circuit rough-in', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['elec'] },
    { key: 'floor', label: 'Install durable flooring', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'builtins', label: 'Install bench, hooks & cubbies', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'punch', label: 'Punch list', phase: 'punch-list', dependsOn: ['builtins'] },
  ],
}

export const hallwayStairs: RoomTemplate = {
  type: 'hallway-stairs',
  checklist: [
    { label: 'Transition moments (art, color shifts)', category: 'Layout', psychologyTag: 'entry-sequence-transitions' },
    { label: 'Paint colors (space-expanding)', category: 'Surfaces', psychologyTag: 'color-psychology' },
    { label: 'Treads & risers', category: 'Flooring' },
    { label: 'Lighting / night path', category: 'Lighting', psychologyTag: 'lighting-circadian' },
    { label: 'Handrail code check', category: 'Safety' },
    { label: 'Smoke & CO detector placement', category: 'Safety' },
  ],
  tasks: [
    { key: 'demo', label: 'Prep & demo', phase: 'demo' },
    { key: 'elec', label: 'Lighting & detector rough-in', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'paint', label: 'Prime & paint', phase: 'paint', dependsOn: ['elec'] },
    { key: 'treads', label: 'Install treads & risers', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'rail', label: 'Handrail install (code height)', phase: 'trim', dependsOn: ['treads'] },
    { key: 'punch', label: 'Detectors & punch list', phase: 'punch-list', dependsOn: ['rail'] },
  ],
}

export const garage: RoomTemplate = {
  type: 'garage',
  checklist: [
    { label: 'Epoxy floor', category: 'Flooring' },
    { label: 'Lighting', category: 'Lighting' },
    { label: 'Outlets & EV circuit', category: 'Electrical' },
    { label: 'Insulation', category: 'Comfort' },
    { label: 'Storage systems', category: 'Storage', psychologyTag: 'clutter-cognitive-load' },
  ],
  tasks: [
    { key: 'demo', label: 'Clear & prep', phase: 'demo' },
    { key: 'elec', label: 'EV circuit, outlets & lighting rough-in', phase: 'rough-in', dependsOn: ['demo'] },
    { key: 'insul', label: 'Insulation', phase: 'insulation', dependsOn: ['elec'] },
    { key: 'drywall', label: 'Drywall & fire separation', phase: 'drywall', dependsOn: ['insul'] },
    { key: 'paint', label: 'Paint', phase: 'paint', dependsOn: ['drywall'] },
    { key: 'floor', label: 'Epoxy floor coating', phase: 'flooring', dependsOn: ['paint'] },
    { key: 'storage', label: 'Install storage systems', phase: 'fixtures', dependsOn: ['floor'] },
    { key: 'punch', label: 'Punch list', phase: 'punch-list', dependsOn: ['storage'] },
  ],
}

export const exterior: RoomTemplate = {
  type: 'exterior',
  checklist: [
    { label: 'Pressure wash', category: 'Exterior' },
    { label: 'Paint / siding', category: 'Exterior', psychologyTag: 'color-psychology' },
    { label: 'Gutters', category: 'Exterior' },
    { label: 'Exterior & entry lighting', category: 'Lighting', psychologyTag: 'entry-sequence-transitions' },
    { label: 'Landscaping & planting', category: 'Exterior', psychologyTag: 'biophilic-design' },
  ],
  tasks: [
    { key: 'wash', label: 'Pressure wash & surface prep', phase: 'demo' },
    { key: 'repair', label: 'Siding & trim repairs', phase: 'demo', dependsOn: ['wash'] },
    { key: 'paint', label: 'Paint / finish siding', phase: 'paint', dependsOn: ['repair'] },
    { key: 'gutters', label: 'Gutters & downspouts', phase: 'fixtures', dependsOn: ['paint'] },
    { key: 'light', label: 'Exterior lighting install', phase: 'fixtures', dependsOn: ['paint'] },
    { key: 'punch', label: 'Landscaping & punch list', phase: 'punch-list', dependsOn: ['gutters', 'light'] },
  ],
}
