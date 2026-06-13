import { inspiration as SEEDS } from 'virtual:research-content'
import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { InspirationItem, RoomType } from '~/models'
import type { InspirationSeed } from '~/utils/inspiration-parse'
import { inspirationCol } from '~/utils/firestore-paths'
import { ROOM_TYPE_PSYCHOLOGY } from '~/config/inspiration'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

export function inspirationSeedsForType(roomType: string): InspirationSeed[] {
  return SEEDS.filter(s => s.roomType === roomType)
}

export const useProjectInspiration = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? inspirationCol(db, projectStore.activeOwnerUid, projectStore.currentProjectId)
      : null,
  )
  const items = useCollection<InspirationItem>(source, { ssrKey: 'inspiration' })

  const byRoomType = (roomType: RoomType) => items.value.filter(i => i.roomType === roomType)
  const byRoom = (roomId: string) => items.value.filter(i => i.roomId === roomId)

  return { items, byRoomType, byRoom }
})

export type NewInspirationFields = Omit<InspirationItem, 'id' | 'uid' | 'projectId'>

export function useInspirationOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (i: InspirationItem) => doc(inspirationCol(db, i.uid, i.projectId), i.id)

  function add(fields: NewInspirationFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(inspirationCol(db, ownerUid, projectId))
    const item: InspirationItem = { id: ref.id, uid: ownerUid, projectId, ...fields }
    void sync.track(() => setDoc(ref, item))
  }

  function save(item: InspirationItem): void {
    void sync.track(() => setDoc(refFor(item), item))
  }

  function remove(item: InspirationItem): void {
    void sync.track(() => deleteDoc(refFor(item)))
    undo.offer(`Removed "${item.title}"`, () => sync.track(() => setDoc(refFor(item), item)))
  }

  // One-click import of the researched seeds for a room type (UX10), skipping
  // any already present (matched by URL). Seeds carry the room type's
  // representative psychology tag so each card cross-links to the research.
  function importSeeds(roomType: RoomType, existingUrls: Set<string>): number {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return 0
    const tags = ROOM_TYPE_PSYCHOLOGY[roomType] ?? []
    let added = 0
    for (const seed of inspirationSeedsForType(roomType)) {
      if (existingUrls.has(seed.url)) continue
      const ref = doc(inspirationCol(db, ownerUid, projectId))
      const item: InspirationItem = {
        id: ref.id,
        uid: ownerUid,
        projectId,
        roomType,
        title: seed.title,
        url: seed.url,
        psychologyTags: tags,
        ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
        ...(seed.description ? { notes: seed.description } : {}),
      }
      void sync.track(() => setDoc(ref, item))
      added++
    }
    return added
  }

  return { add, save, remove, importSeeds }
}
