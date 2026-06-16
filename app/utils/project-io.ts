import { z } from 'zod'
import { Timestamp } from 'firebase/firestore'
import {
  BudgetLine,
  ChecklistItem,
  InspirationItem,
  Item,
  Paint,
  Permit,
  Photo,
  Project,
  Room,
  SCHEMA_VERSION,
  Task,
} from '~/models'

// Full project tree, flattened by collection — the unit of export/import and
// the shape stores hydrate into. `items` is the unified Shopping & Selections
// collection (merged from the former selections[] + purchases[] at schema v2).
export interface ProjectBundle {
  project: Project
  rooms: Room[]
  checklist: ChecklistItem[]
  budgetLines: BudgetLine[]
  tasks: Task[]
  items: Item[]
  photos: Photo[]
  paints: Paint[]
  permits: Permit[]
  inspiration: InspirationItem[]
}

export interface ProjectExport {
  schemaVersion: number
  exportedAt: string
  bundle: unknown
}

const TS_TAG = 'firestore/timestamp/1.0'

// Firestore Timestamps are not JSON-native; tag them on the way out and rebuild
// them on the way in so a round-trip is loss-free.
function toJsonSafe(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { __type: TS_TAG, seconds: value.seconds, nanoseconds: value.nanoseconds }
  }
  if (Array.isArray(value)) return value.map(toJsonSafe)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toJsonSafe(v)]),
    )
  }
  return value
}

function fromJsonSafe(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if (obj.__type === TS_TAG) {
      return new Timestamp(obj.seconds as number, obj.nanoseconds as number)
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fromJsonSafe(v)]))
  }
  if (Array.isArray(value)) return value.map(fromJsonSafe)
  return value
}

// Serialize a project tree to a versioned, JSON-safe export document.
export function exportProject(bundle: ProjectBundle, exportedAt: string): ProjectExport {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    bundle: toJsonSafe(bundle),
  }
}

// v1 statuses fold onto the unified item lifecycle. Operates on plain JSON
// (pre-Timestamp-rehydration), so it only reshapes fields — BundleSchema does
// the real validation afterward.
function mapPurchaseStatus(s: unknown): string {
  return s === 'to-buy' || s === 'purchased' ? s : 'idea'
}
const SELECTION_STATUS_MAP: Record<string, string> = {
  considering: 'idea',
  decided: 'to-buy',
  ordered: 'purchased',
  delivered: 'delivered',
  installed: 'installed',
}
function mapSelectionStatus(s: unknown): string {
  return (typeof s === 'string' && SELECTION_STATUS_MAP[s]) || 'idea'
}
function migratePurchaseDoc(p: Record<string, unknown>): Record<string, unknown> {
  const { title, group, status, ...rest } = p
  return {
    ...rest,
    label: title,
    ...(group != null ? { category: group } : {}),
    status: mapPurchaseStatus(status),
  }
}
function migrateSelectionDoc(s: Record<string, unknown>): Record<string, unknown> {
  return { ...s, status: mapSelectionStatus(s.status) }
}

// Forward-migrate an older export to the current schema. Newer-than-current
// exports are refused by importProject.
//   v1 → v2: fold selections[] + purchases[] into one items[].
function migrate(data: ProjectExport): ProjectExport {
  if (data.schemaVersion >= 2) return data
  const b = (data.bundle ?? {}) as Record<string, unknown>
  const selections = Array.isArray(b.selections) ? (b.selections as Record<string, unknown>[]) : []
  const purchases = Array.isArray(b.purchases) ? (b.purchases as Record<string, unknown>[]) : []
  // Dedup by id (selection + purchase ids could astronomically-rarely collide):
  // one items[] entry per id, else the import would write the same path twice.
  const merged = [...selections.map(migrateSelectionDoc), ...purchases.map(migratePurchaseDoc)]
  const items = [...new Map(merged.map(i => [i.id as string, i])).values()]
  const { selections: _s, purchases: _p, ...restBundle } = b
  return { ...data, schemaVersion: 2, bundle: { ...restBundle, items } }
}

const BundleSchema = z.object({
  project: Project,
  rooms: z.array(Room),
  checklist: z.array(ChecklistItem),
  budgetLines: z.array(BudgetLine),
  tasks: z.array(Task),
  items: z.array(Item),
  photos: z.array(Photo),
  paints: z.array(Paint),
  permits: z.array(Permit),
  inspiration: z.array(InspirationItem),
})

// Validate + rebuild a project tree from an export document. Refuses exports
// newer than the supported schema; migrates older ones.
export function importProject(data: ProjectExport): ProjectBundle {
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Export schemaVersion ${data.schemaVersion} is newer than supported ${SCHEMA_VERSION}; upgrade the app to import it.`,
    )
  }
  const migrated = migrate(data)
  const raw = fromJsonSafe(migrated.bundle)
  return BundleSchema.parse(raw)
}
