import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { Paint } from '~/models'
import { paintsCol } from '~/utils/firestore-paths'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// Per-room paint colors, bound directly (no project-wide rollup needed — paints
// live on the room detail page, like photos).
export function useRoomPaints(roomId: () => string) {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId && roomId()
      ? paintsCol(db, projectStore.activeOwnerUid, projectStore.currentProjectId, roomId())
      : null,
  )
  const paints = useCollection<Paint>(source, { ssrKey: 'room-paints' })

  return { paints }
}

export type NewPaintFields = Omit<Paint, 'id' | 'uid' | 'projectId' | 'roomId'>

export function usePaintOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (p: Paint) => doc(paintsCol(db, p.uid, p.projectId, p.roomId), p.id)

  function add(roomId: string, fields: NewPaintFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(paintsCol(db, ownerUid, projectId, roomId))
    const paint: Paint = { id: ref.id, uid: ownerUid, projectId, roomId, ...fields }
    void sync.track(() => setDoc(ref, paint))
  }

  function save(paint: Paint): void {
    void sync.track(() => setDoc(refFor(paint), paint))
  }

  function remove(paint: Paint): void {
    void sync.track(() => deleteDoc(refFor(paint)))
    undo.offer(`Deleted "${paint.name}"`, () => sync.track(() => setDoc(refFor(paint), paint)))
  }

  return { add, save, remove }
}
