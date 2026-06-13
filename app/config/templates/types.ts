import type { RoomType, TaskPhase } from '~/models'

// Room-type template catalog types (Phase 5). Applying a template seeds
// checklist items (fromTemplate: true) and phase-ordered default tasks with
// sensible, editable dependencies.

export interface TemplateChecklistItem {
  label: string
  category: string
  /** Slug into the design-psychology corpus — renders an info popover. */
  psychologyTag?: string
}

export interface TemplateTask {
  /** Template-local key, used only to wire dependsOn before doc ids exist. */
  key: string
  label: string
  phase: TaskPhase
  /** Keys of template tasks this one depends on. */
  dependsOn?: string[]
}

export interface RoomTemplate {
  type: RoomType
  checklist: TemplateChecklistItem[]
  tasks: TemplateTask[]
}

// Canonical display order for checklist categories (UX5 chunking). Categories
// not listed sort after these, alphabetically.
export const CATEGORY_ORDER = [
  'Layout',
  'Surfaces',
  'Flooring',
  'Lighting',
  'Electrical',
  'Plumbing',
  'Ventilation',
  'Fixtures',
  'Appliances',
  'Storage',
  'Comfort',
  'Safety',
  'Exterior',
] as const

export function categoryRank(category: string): number {
  const i = (CATEGORY_ORDER as readonly string[]).indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}
