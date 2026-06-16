import { deleteDoc, deleteField, doc, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useCollection, useFirebaseStorage, useFirestore } from 'vuefire'
import type { BudgetLine, Item, ItemStatus } from '~/models'
import { budgetLinesCol, itemsCol, itemsGroup } from '~/utils/firestore-paths'
import { itemImagePath, itemReceiptPath } from '~/utils/storage-paths'
import { computeExpectedAt, isOverdue, todayDateOnly } from '~/utils/selection-math'
import { downscaleToBlob } from '~/utils/image-downscale'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// Item photos are downscaled before upload — full-res isn't needed for a card.
const ITEM_IMAGE_EDGE = 1280
// Receipts downscale less aggressively so small printed text stays legible.
const RECEIPT_IMAGE_EDGE = 2400

// THE items listener for the current project (collection-group, member-aware).
// createSharedComposable so the room detail section, the by-room inspiration
// view, overdue surfaces, and the task-gating composable all read one binding.
export const useProjectItems = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? query(
          itemsGroup(db),
          where('uid', '==', projectStore.activeOwnerUid),
          where('projectId', '==', projectStore.currentProjectId),
        )
      : null,
  )
  const items = useCollection<Item>(source, { ssrKey: 'items' })

  const byRoom = (roomId: string) => items.value.filter(i => i.roomId === roomId)
  const isItemOverdue = (i: Item) =>
    isOverdue(i.expectedAt, i.status, todayDateOnly(new Date()))
  const overdue = computed(() => items.value.filter(isItemOverdue))
  const overdueRoomIds = computed(() => new Set(overdue.value.map(i => i.roomId)))

  return { items, byRoom, overdue, overdueRoomIds, isItemOverdue }
})

export type NewItemFields = Omit<Item, 'id' | 'uid' | 'projectId' | 'roomId'>

export function useItemOps() {
  const db = useFirestore()
  const storage = useFirebaseStorage()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (i: Item) => doc(itemsCol(db, i.uid, i.projectId, i.roomId), i.id)

  function add(roomId: string, fields: NewItemFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(itemsCol(db, ownerUid, projectId, roomId))
    const item: Item = { id: ref.id, uid: ownerUid, projectId, roomId, ...fields }
    void sync.track(() => setDoc(ref, item))
  }

  function save(item: Item): void {
    void sync.track(() => setDoc(refFor(item), item))
  }

  function remove(item: Item): void {
    void sync.track(() => deleteDoc(refFor(item)))
    undo.offer(`Deleted "${item.label}"`, () => sync.track(() => setDoc(refFor(item), item)))
  }

  // Inline star-rank from the card (no dialog round-trip).
  function setRank(item: Item, rank: number): void {
    if (item.rank === rank) return
    void sync.track(() => updateDoc(refFor(item), { rank } as UpdateData<Item>))
  }

  // Advancing to 'purchased' stamps orderedAt and derives expectedAt from the
  // lead time (the schedule fact the procurement phase exists to track) — this
  // is where the old Shopping "purchased" action joins the selection lifecycle.
  function setStatus(item: Item, status: ItemStatus): void {
    if (item.status === status) return
    const patch: Partial<Item> = { status }
    if (status === 'purchased' && !item.orderedAt) {
      const orderedAt = Timestamp.now()
      patch.orderedAt = orderedAt
      if (item.leadTimeDays != null) {
        patch.expectedAt = computeExpectedAt(orderedAt, item.leadTimeDays)
      }
    }
    void sync.track(() => updateDoc(refFor(item), patch as UpdateData<Item>))
  }

  // Push a linked item's price into its budget line's actual (offered on
  // purchase). No-op when unlinked or priceless.
  function applyPriceToBudgetLine(item: Item): void {
    if (!item.budgetLineId || item.priceCents == null) return
    const ref = doc(budgetLinesCol(db, item.uid, item.projectId, item.roomId), item.budgetLineId)
    void sync.track(() => updateDoc(ref, { actualCents: item.priceCents } as UpdateData<BudgetLine>))
  }

  // Upload (and replace) a photo of the item: downscale, store at the item's
  // fixed path (overwrites any prior), then persist its download URL + path.
  async function uploadImage(item: Item, file: File): Promise<void> {
    const blob = await downscaleToBlob(file, ITEM_IMAGE_EDGE)
    const path = itemImagePath(item.uid, item.projectId, item.roomId, item.id)
    const sref = storageRef(storage, path)
    await uploadBytes(sref, blob, { contentType: 'image/jpeg' })
    const imageUrl = await getDownloadURL(sref)
    await sync.track(() => updateDoc(refFor(item), { imageUrl, imagePath: path } as UpdateData<Item>))
  }

  async function removeImage(item: Item): Promise<void> {
    if (item.imagePath) {
      try { await deleteObject(storageRef(storage, item.imagePath)) }
      catch { /* object already gone */ }
    }
    await sync.track(() =>
      updateDoc(refFor(item), { imageUrl: deleteField(), imagePath: deleteField() } as UpdateData<Item>),
    )
  }

  // Receipt for a purchased item: a photo (downscaled) or a PDF (as-is).
  async function uploadReceipt(item: Item, file: File): Promise<void> {
    const isPdf = file.type === 'application/pdf'
    const path = itemReceiptPath(item.uid, item.projectId, item.roomId, item.id)
    const sref = storageRef(storage, path)
    if (isPdf) {
      await uploadBytes(sref, file, { contentType: 'application/pdf' })
    }
    else {
      const blob = await downscaleToBlob(file, RECEIPT_IMAGE_EDGE)
      await uploadBytes(sref, blob, { contentType: 'image/jpeg' })
    }
    const receiptUrl = await getDownloadURL(sref)
    await sync.track(() => updateDoc(refFor(item), {
      receiptUrl,
      receiptPath: path,
      receiptType: isPdf ? 'application/pdf' : 'image/jpeg',
    } as UpdateData<Item>))
  }

  async function removeReceipt(item: Item): Promise<void> {
    if (item.receiptPath) {
      try { await deleteObject(storageRef(storage, item.receiptPath)) }
      catch { /* object already gone */ }
    }
    await sync.track(() => updateDoc(refFor(item), {
      receiptUrl: deleteField(),
      receiptPath: deleteField(),
      receiptType: deleteField(),
    } as UpdateData<Item>))
  }

  return {
    add, save, remove, setRank, setStatus, applyPriceToBudgetLine,
    uploadImage, removeImage, uploadReceipt, removeReceipt,
  }
}
