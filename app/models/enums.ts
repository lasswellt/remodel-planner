import { z } from 'zod'

// Room types — must match the inspiration-index.md slugs and the Phase 5
// template catalog.
export const RoomType = z.enum([
  'kitchen',
  'bathroom',
  'bedroom',
  'living-room',
  'dining-room',
  'home-office',
  'laundry-utility',
  'mudroom-entry',
  'hallway-stairs',
  'garage',
  'exterior',
])
export type RoomType = z.infer<typeof RoomType>

// Real remodel sequencing. Order is significant — used for phase rollups and
// inspection-gate ordering (an earlier phase gates later ones).
export const TaskPhase = z.enum([
  'demo',
  'rough-in',
  'insulation',
  'drywall',
  'paint',
  'flooring',
  'trim',
  'fixtures',
  'punch-list',
])
export type TaskPhase = z.infer<typeof TaskPhase>

export const TASK_PHASE_ORDER: readonly TaskPhase[] = TaskPhase.options

export const RoomStatus = z.enum(['planned', 'in-progress', 'done'])
export type RoomStatus = z.infer<typeof RoomStatus>

export const BudgetCategory = z.enum([
  'materials',
  'labor',
  'permits',
  'fixtures',
  'other',
])
export type BudgetCategory = z.infer<typeof BudgetCategory>

export const TaskStatus = z.enum(['todo', 'in-progress', 'blocked', 'done'])
export type TaskStatus = z.infer<typeof TaskStatus>

// Unified Shopping & Selections lifecycle (one continuous flow): an item starts
// as a loose idea, becomes something to buy, is purchased (order placed / bought
// — stamps the order date and starts the lead-time clock), then arrives and is
// installed. Replaces the former split PurchaseStatus + SelectionStatus.
export const ItemStatus = z.enum([
  'idea',
  'to-buy',
  'purchased',
  'delivered',
  'installed',
])
export type ItemStatus = z.infer<typeof ItemStatus>

// Declaration order is the lifecycle order; the section sorts by it.
export const ITEM_STATUS_ORDER: readonly ItemStatus[] = ItemStatus.options

// An item stops blocking dependent tasks (and stops being "overdue") once it has
// physically arrived. Shared by selection-math + task-graph.
export const ARRIVED_STATUSES: readonly ItemStatus[] = ['delivered', 'installed']

export const PermitStatus = z.enum(['needed', 'applied', 'issued', 'closed'])
export type PermitStatus = z.infer<typeof PermitStatus>

export const InspectionStatus = z.enum([
  'pending',
  'scheduled',
  'passed',
  'failed',
])
export type InspectionStatus = z.infer<typeof InspectionStatus>

export const PhotoStage = z.enum(['before', 'during', 'after'])
export type PhotoStage = z.infer<typeof PhotoStage>

// Paint finish (sheen). Order runs flat → gloss.
export const PaintFinish = z.enum([
  'flat',
  'matte',
  'eggshell',
  'satin',
  'semi-gloss',
  'gloss',
])
export type PaintFinish = z.infer<typeof PaintFinish>

// Surface a paint color is applied to.
export const PaintSurface = z.enum([
  'walls',
  'trim',
  'ceiling',
  'cabinets',
  'doors',
  'accent-wall',
  'exterior',
])
export type PaintSurface = z.infer<typeof PaintSurface>

