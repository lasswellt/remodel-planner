import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import type { ChecklistItem, Room } from '~/models'
import { categoryRank } from '~/config/templates'
import { checklistCol } from '~/utils/firestore-paths'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

export function useChecklistOps() {
  const db = useFirestore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (item: ChecklistItem) =>
    doc(checklistCol(db, item.uid, item.projectId, item.roomId), item.id)

  function toggle(item: ChecklistItem, done: boolean) {
    void sync.track(() => updateDoc(refFor(item), { done }))
  }

  function remove(item: ChecklistItem) {
    void sync.track(() => deleteDoc(refFor(item)))
    undo.offer(`Deleted "${item.label}"`, () =>
      sync.track(() => setDoc(refFor(item), item)),
    )
  }

  return { toggle, remove }
}

export function useChecklist(room: () => Room | null) {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const rollup = useRollup()

  // Tolerates a null room: the room-detail page mounts before its VueFire
  // collection resolves (and on a missing/foreign id), so every derived value
  // must be safe to read while room() is null — otherwise the empty-state
  // can never render (the immediate collapse watcher would throw first).
  const items = computed(() => {
    const r = room()
    if (!r) return [] as ChecklistItem[]
    return rollup.checklist.value
      .filter(item => item.roomId === r.id)
      .sort(
        (a, b) =>
          categoryRank(a.category) - categoryRank(b.category)
          || a.category.localeCompare(b.category)
          || a.label.localeCompare(b.label),
      )
  })

  const grouped = computed(() => {
    const map = new Map<string, ChecklistItem[]>()
    for (const item of items.value) {
      const group = map.get(item.category)
      if (group) group.push(item)
      else map.set(item.category, [item])
    }
    return map
  })

  const hasTemplate = computed(() => items.value.some(i => i.fromTemplate))

  function add(label: string, category: string) {
    const r = room()
    const ownerUid = projectStore.activeOwnerUid
    if (!r || !ownerUid) return
    const col = checklistCol(db, ownerUid, r.projectId, r.id)
    const ref = doc(col)
    const item: ChecklistItem = {
      id: ref.id,
      uid: ownerUid,
      projectId: r.projectId,
      roomId: r.id,
      label,
      category,
      done: false,
      fromTemplate: false,
    }
    void sync.track(() => setDoc(ref, item))
  }

  return { items, grouped, hasTemplate, add }
}
