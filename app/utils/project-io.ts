import { z } from 'zod'
import { Timestamp } from 'firebase/firestore'
import {
  BudgetLine,
  ChecklistItem,
  InspirationItem,
  Paint,
  Permit,
  Photo,
  Project,
  PurchaseItem,
  Room,
  SCHEMA_VERSION,
  Selection,
  Task,
} from '~/models'

// Full project tree, flattened by collection — the unit of export/import and
// the shape stores hydrate into.
export interface ProjectBundle {
  project: Project
  rooms: Room[]
  checklist: ChecklistItem[]
  budgetLines: BudgetLine[]
  tasks: Task[]
  selections: Selection[]
  photos: Photo[]
  paints: Paint[]
  purchases: PurchaseItem[]
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

// Forward-migrate an older export to the current schema. Identity at v1; future
// versions add cases here. Newer-than-current exports are refused by importProject.
function migrate(data: ProjectExport): ProjectExport {
  return data
}

const BundleSchema = z.object({
  project: Project,
  rooms: z.array(Room),
  checklist: z.array(ChecklistItem),
  budgetLines: z.array(BudgetLine),
  tasks: z.array(Task),
  selections: z.array(Selection),
  photos: z.array(Photo),
  paints: z.array(Paint),
  purchases: z.array(PurchaseItem),
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
