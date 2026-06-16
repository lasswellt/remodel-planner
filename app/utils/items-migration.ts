import type { Firestore } from 'firebase/firestore'
import { collection, doc, getDocsFromServer, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import type { Item, ItemStatus } from '~/models'
import { Item as ItemSchema } from '~/models'
import { itemsCol, projectDoc, roomsCol } from '~/utils/firestore-paths'

// One-time migration that folds the former split `selections` + `purchases`
// subcollections into the unified `items` subcollection. Idempotent: gated by
// project.itemsMigratedAt and safe to re-run (writes reuse each source doc's id,
// so a partial run is simply completed on the next pass). Legacy docs are NOT
// deleted here — they stay one release as a rollback safety net.
//
// Enumeration MUST come from the server (getDocsFromServer): with offline
// persistence on, plain getDocs would resolve from the local cache (empty for a
// subcollection never bound by a listener) and silently migrate nothing.

const BATCH_LIMIT = 450 // headroom under Firestore's 500-op batch cap

// purchased lifecycle was idea | to-buy | purchased — all valid item statuses.
function mapPurchaseStatus(s: unknown): ItemStatus {
  return s === 'to-buy' || s === 'purchased' ? s : 'idea'
}
// selection lifecycle considering | decided | ordered | delivered | installed
// folds onto the unified spine; 'ordered' becomes 'purchased' (order placed).
const SELECTION_STATUS_MAP: Record<string, ItemStatus> = {
  considering: 'idea',
  decided: 'to-buy',
  ordered: 'purchased',
  delivered: 'delivered',
  installed: 'installed',
}
function mapSelectionStatus(s: unknown): ItemStatus {
  return (typeof s === 'string' && SELECTION_STATUS_MAP[s]) || 'idea'
}

// Copy a value through only when present (Firestore rejects undefined fields).
function put(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined && value !== null) target[key] = value
}

function purchaseToItem(raw: Record<string, unknown>): Item | null {
  const out: Record<string, unknown> = {
    uid: raw.uid,
    projectId: raw.projectId,
    roomId: raw.roomId,
    id: raw.id,
    label: raw.title,
    status: mapPurchaseStatus(raw.status),
  }
  put(out, 'category', raw.group)
  put(out, 'rank', raw.rank)
  put(out, 'vendor', raw.vendor)
  put(out, 'url', raw.url)
  put(out, 'notes', raw.notes)
  put(out, 'priceCents', raw.priceCents)
  put(out, 'imageUrl', raw.imageUrl)
  put(out, 'imagePath', raw.imagePath)
  put(out, 'receiptUrl', raw.receiptUrl)
  put(out, 'receiptPath', raw.receiptPath)
  put(out, 'receiptType', raw.receiptType)
  const parsed = ItemSchema.safeParse(out)
  return parsed.success ? parsed.data : null
}

function selectionToItem(raw: Record<string, unknown>): Item | null {
  const out: Record<string, unknown> = {
    uid: raw.uid,
    projectId: raw.projectId,
    roomId: raw.roomId,
    id: raw.id,
    label: raw.label,
    status: mapSelectionStatus(raw.status),
  }
  put(out, 'category', raw.category)
  put(out, 'vendor', raw.vendor)
  put(out, 'sku', raw.sku)
  put(out, 'url', raw.url)
  put(out, 'priceCents', raw.priceCents)
  put(out, 'leadTimeDays', raw.leadTimeDays)
  put(out, 'orderedAt', raw.orderedAt)
  put(out, 'expectedAt', raw.expectedAt)
  put(out, 'budgetLineId', raw.budgetLineId)
  const parsed = ItemSchema.safeParse(out)
  return parsed.success ? parsed.data : null
}

async function legacyItemsForRoom(
  db: Firestore,
  uid: string,
  projectId: string,
  roomId: string,
): Promise<Item[]> {
  const base = ['users', uid, 'projects', projectId, 'rooms', roomId] as const
  const [sels, purs] = await Promise.all([
    getDocsFromServer(collection(db, ...base, 'selections')),
    getDocsFromServer(collection(db, ...base, 'purchases')),
  ])
  const out: Item[] = []
  for (const d of sels.docs) {
    const item = selectionToItem({ ...d.data(), id: d.id, roomId, uid, projectId })
    if (item) out.push(item)
  }
  for (const d of purs.docs) {
    const item = purchaseToItem({ ...d.data(), id: d.id, roomId, uid, projectId })
    if (item) out.push(item)
  }
  return out
}

async function writeItems(db: Firestore, items: Item[]): Promise<void> {
  // Dedup by id before writing: selection + purchase ids are generated per
  // source collection and could (astronomically rarely) collide, which would
  // otherwise write the same items/{id} path twice and silently lose one doc.
  const unique = [...new Map(items.map(i => [i.id, i])).values()]
  for (let i = 0; i < unique.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const item of unique.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(itemsCol(db, item.uid, item.projectId, item.roomId), item.id), item)
    }
    await batch.commit()
  }
}

// Migrate an owner's whole project. Returns the number of items written. Throws
// if Firestore can't be reached (offline) so the caller leaves the marker unset
// and retries later. The marker write is the last step.
export async function migrateProjectToItems(
  db: Firestore,
  uid: string,
  projectId: string,
): Promise<number> {
  const rooms = await getDocsFromServer(roomsCol(db, uid, projectId))
  const all: Item[] = []
  for (const room of rooms.docs) {
    all.push(...(await legacyItemsForRoom(db, uid, projectId, room.id)))
  }
  await writeItems(db, all)
  await updateDoc(projectDoc(db, uid, projectId), { itemsMigratedAt: Timestamp.now() })
  return all.length
}
