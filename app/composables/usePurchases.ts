import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { PurchaseItem, PurchaseStatus } from '~/models'
import { purchasesCol } from '~/utils/firestore-paths'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// Per-room purchase items / ideas, bound directly. Grouped + ranked in the UI.
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

export type NewPurchaseFields = Omit<PurchaseItem, 'id' | 'uid' | 'projectId' | 'roomId'>

export function usePurchaseOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (p: PurchaseItem) => doc(purchasesCol(db, p.uid, p.projectId, p.roomId), p.id)

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

  return { add, save, remove, setRank, setStatus }
}
