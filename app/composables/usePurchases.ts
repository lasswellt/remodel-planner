import { deleteDoc, deleteField, doc, query, setDoc, updateDoc, where } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useCollection, useFirebaseStorage, useFirestore } from 'vuefire'
import type { PurchaseItem, PurchaseStatus } from '~/models'
import { purchasesCol, purchasesGroup } from '~/utils/firestore-paths'
import { purchaseImagePath, purchaseReceiptPath } from '~/utils/storage-paths'
import { downscaleToBlob } from '~/utils/image-downscale'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// Item photos are downscaled before upload — full-res isn't needed for a card.
const PURCHASE_IMAGE_EDGE = 1280
// Receipts downscale less aggressively so small printed text stays legible.
const RECEIPT_IMAGE_EDGE = 2400

// Per-room purchase items / ideas, bound directly. Grouped + ranked in the UI.
// Used by the single-room detail page. A falsy roomId yields a null source (no
// listener) so a parent can suppress this and feed pre-fetched items instead.
export function useRoomPurchases(roomId: () => string) {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId && roomId()
      ? purchasesCol(db, projectStore.activeOwnerUid, projectStore.currentProjectId, roomId())
      : null,
  )
  const purchases = useCollection<PurchaseItem>(source, { ssrKey: 'room-purchases' })

  return { purchases }
}

// THE project-wide purchases listener (collection-group, member-aware), shared
// across consumers via createSharedComposable. The by-room inspiration view uses
// this single listener + byRoom() instead of one per-room listener per room.
export const useProjectPurchases = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? query(
          purchasesGroup(db),
          where('uid', '==', projectStore.activeOwnerUid),
          where('projectId', '==', projectStore.currentProjectId),
        )
      : null,
  )
  const purchases = useCollection<PurchaseItem>(source, { ssrKey: 'project-purchases' })
  const byRoom = (roomId: string) => purchases.value.filter(p => p.roomId === roomId)

  return { purchases, byRoom }
})

export type NewPurchaseFields = Omit<PurchaseItem, 'id' | 'uid' | 'projectId' | 'roomId'>

export function usePurchaseOps() {
  const db = useFirestore()
  const storage = useFirebaseStorage()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (p: PurchaseItem) => doc(purchasesCol(db, p.uid, p.projectId, p.roomId), p.id)

  // Upload (and replace) a photo of the item: downscale, store at the item's
  // fixed path (overwrites any prior), then persist its download URL + path.
  async function uploadImage(item: PurchaseItem, file: File): Promise<void> {
    const blob = await downscaleToBlob(file, PURCHASE_IMAGE_EDGE)
    const path = purchaseImagePath(item.uid, item.projectId, item.roomId, item.id)
    const sref = storageRef(storage, path)
    await uploadBytes(sref, blob, { contentType: 'image/jpeg' })
    const imageUrl = await getDownloadURL(sref)
    await sync.track(() => updateDoc(refFor(item), { imageUrl, imagePath: path } as UpdateData<PurchaseItem>))
  }

  async function removeImage(item: PurchaseItem): Promise<void> {
    if (item.imagePath) {
      try { await deleteObject(storageRef(storage, item.imagePath)) }
      catch { /* object already gone */ }
    }
    await sync.track(() =>
      updateDoc(refFor(item), { imageUrl: deleteField(), imagePath: deleteField() } as UpdateData<PurchaseItem>),
    )
  }

  // Receipt for a purchased item: a photo (downscaled) or a PDF (as-is).
  async function uploadReceipt(item: PurchaseItem, file: File): Promise<void> {
    const isPdf = file.type === 'application/pdf'
    const path = purchaseReceiptPath(item.uid, item.projectId, item.roomId, item.id)
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
    } as UpdateData<PurchaseItem>))
  }

  async function removeReceipt(item: PurchaseItem): Promise<void> {
    if (item.receiptPath) {
      try { await deleteObject(storageRef(storage, item.receiptPath)) }
      catch { /* object already gone */ }
    }
    await sync.track(() => updateDoc(refFor(item), {
      receiptUrl: deleteField(),
      receiptPath: deleteField(),
      receiptType: deleteField(),
    } as UpdateData<PurchaseItem>))
  }

  function add(roomId: string, fields: NewPurchaseFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(purchasesCol(db, ownerUid, projectId, roomId))
    const item: PurchaseItem = { id: ref.id, uid: ownerUid, projectId, roomId, ...fields }
    void sync.track(() => setDoc(ref, item))
  }

  function save(item: PurchaseItem): void {
    void sync.track(() => setDoc(refFor(item), item))
  }

  function remove(item: PurchaseItem): void {
    void sync.track(() => deleteDoc(refFor(item)))
    undo.offer(`Deleted "${item.title}"`, () => sync.track(() => setDoc(refFor(item), item)))
  }

  // Inline star-rank from the card (no dialog round-trip).
  function setRank(item: PurchaseItem, rank: number): void {
    if (item.rank === rank) return
    void sync.track(() => updateDoc(refFor(item), { rank } as UpdateData<PurchaseItem>))
  }

  function setStatus(item: PurchaseItem, status: PurchaseStatus): void {
    if (item.status === status) return
    void sync.track(() => updateDoc(refFor(item), { status } as UpdateData<PurchaseItem>))
  }

  return { add, save, remove, setRank, setStatus, uploadImage, removeImage, uploadReceipt, removeReceipt }
}
