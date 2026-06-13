import { deleteDoc, doc, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { BudgetLine, Selection, SelectionStatus } from '~/models'
import { budgetLinesCol, selectionsCol, selectionsGroup } from '~/utils/firestore-paths'
import { computeExpectedAt, isOverdue, todayDateOnly } from '~/utils/selection-math'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// THE selections listener for the current project (collection-group, member-
// aware). createSharedComposable so the room detail list, overdue surfaces, and
// the task-gating composable all read one binding (useTasks consumes this).
export const useProjectSelections = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? query(
          selectionsGroup(db),
          where('uid', '==', projectStore.activeOwnerUid),
          where('projectId', '==', projectStore.currentProjectId),
        )
      : null,
  )
  const selections = useCollection<Selection>(source, { ssrKey: 'selections' })

  const byRoom = (roomId: string) => selections.value.filter(s => s.roomId === roomId)
  const isSelectionOverdue = (s: Selection) =>
    isOverdue(s.expectedAt, s.status, todayDateOnly(new Date()))
  const overdue = computed(() => selections.value.filter(isSelectionOverdue))
  const overdueRoomIds = computed(() => new Set(overdue.value.map(s => s.roomId)))

  return { selections, byRoom, overdue, overdueRoomIds, isSelectionOverdue }
})

export type NewSelectionFields = Omit<Selection, 'id' | 'uid' | 'projectId' | 'roomId'>

export function useSelectionOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (s: Selection) =>
    doc(selectionsCol(db, s.uid, s.projectId, s.roomId), s.id)

  function add(roomId: string, fields: NewSelectionFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(selectionsCol(db, ownerUid, projectId, roomId))
    const sel: Selection = { id: ref.id, uid: ownerUid, projectId, roomId, ...fields }
    void sync.track(() => setDoc(ref, sel))
  }

  function save(selection: Selection): void {
    void sync.track(() => setDoc(refFor(selection), selection))
  }

  function remove(selection: Selection): void {
    void sync.track(() => deleteDoc(refFor(selection)))
    undo.offer(`Deleted "${selection.label}"`, () => sync.track(() => setDoc(refFor(selection), selection)))
  }

  // Advancing to 'ordered' stamps orderedAt and derives expectedAt from the
  // lead time (the schedule fact this whole phase exists to track).
  function setStatus(selection: Selection, status: SelectionStatus): void {
    if (selection.status === status) return
    const patch: Partial<Selection> = { status }
    if (status === 'ordered' && !selection.orderedAt) {
      const orderedAt = Timestamp.now()
      patch.orderedAt = orderedAt
      if (selection.leadTimeDays != null) {
        patch.expectedAt = computeExpectedAt(orderedAt, selection.leadTimeDays)
      }
    }
    void sync.track(() => updateDoc(refFor(selection), patch as UpdateData<Selection>))
  }

  // Push a linked selection's price into its budget line's actual (offered on
  // order). No-op when unlinked or priceless.
  function applyPriceToBudgetLine(selection: Selection): void {
    if (!selection.budgetLineId || selection.priceCents == null) return
    const ref = doc(
      budgetLinesCol(db, selection.uid, selection.projectId, selection.roomId),
      selection.budgetLineId,
    )
    void sync.track(() => updateDoc(ref, { actualCents: selection.priceCents } as UpdateData<BudgetLine>))
  }

  return { add, save, remove, setStatus, applyPriceToBudgetLine }
}
