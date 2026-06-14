import { deleteDoc, doc, query, setDoc, where } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { BudgetLine } from '~/models'
import { budgetLinesCol, budgetLinesGroup } from '~/utils/firestore-paths'
import {
  categoryBreakdown,
  estimateByRoom,
  projectBudget,
  roomBudget,
} from '~/utils/budget-math'
import { useProjectPermits } from '~/composables/usePermits'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// Reactive budget rollup for the current project. createSharedComposable means
// the budget page, room panels, and floorplan over-budget markers read one
// collection-group listener and the same budget-math.ts numbers.
export const useProjectBudget = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const permits = useProjectPermits()

  const scope = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? {
          uid: where('uid', '==', projectStore.activeOwnerUid),
          project: where('projectId', '==', projectStore.currentProjectId),
        }
      : null,
  )
  const source = computed(() =>
    scope.value ? query(budgetLinesGroup(db), scope.value.uid, scope.value.project) : null,
  )
  const lines = useCollection<BudgetLine>(source, { ssrKey: 'budget-lines' })

  // Bucket lines by room once per data change; linesFor/byRoom/overBudgetRoomIds
  // all read this Map instead of each re-filtering the full line list per room
  // (the budget page rendered one full scan per room, O(rooms × lines)).
  const linesByRoom = computed(() => {
    const m = new Map<string, BudgetLine[]>()
    for (const l of lines.value) {
      const g = m.get(l.roomId)
      if (g) g.push(l)
      else m.set(l.roomId, [l])
    }
    return m
  })

  const linesFor = (roomId: string) => linesByRoom.value.get(roomId) ?? []
  const byRoom = (roomId: string) => roomBudget(linesFor(roomId))

  const project = computed(() => {
    const p = projectStore.currentProject
    return projectBudget(
      lines.value,
      p?.totalBudgetCents ?? 0,
      p?.contingencyPct ?? 15,
      permits.totalFeesCents.value,
    )
  })

  // Donut breakdown folds project-level permit fees into the permits category.
  const breakdown = computed(() => {
    const b = categoryBreakdown(lines.value)
    const fees = permits.totalFeesCents.value
    if (fees > 0) b.permits = { estimateCents: b.permits.estimateCents + fees, actualCents: b.permits.actualCents }
    return b
  })

  const byRoomEstimates = (roomIds: string[]) => estimateByRoom(lines.value, roomIds)

  const overBudgetRoomIds = computed(() => {
    const ids = new Set<string>()
    for (const [roomId, ls] of linesByRoom.value) {
      if (roomBudget(ls).overBudget) ids.add(roomId)
    }
    return ids
  })

  return { lines, linesFor, byRoom, project, breakdown, byRoomEstimates, overBudgetRoomIds }
})

export type NewBudgetFields = Omit<BudgetLine, 'id' | 'uid' | 'projectId' | 'roomId'>

// Optimistic budget-line writes (UX9). Deletion is undo-snackbar, not confirm
// (UX8). Mirrors useChecklistOps.
export function useBudgetOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (line: BudgetLine) =>
    doc(budgetLinesCol(db, line.uid, line.projectId, line.roomId), line.id)

  function add(roomId: string, fields: NewBudgetFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(budgetLinesCol(db, ownerUid, projectId, roomId))
    const line: BudgetLine = { id: ref.id, uid: ownerUid, projectId, roomId, ...fields }
    void sync.track(() => setDoc(ref, line))
  }

  // Full-doc replace (converter validates on write); the dialog passes the
  // edited line with its existing id, so create/edit share one path.
  function save(line: BudgetLine): void {
    void sync.track(() => setDoc(refFor(line), line))
  }

  function remove(line: BudgetLine): void {
    void sync.track(() => deleteDoc(refFor(line)))
    undo.offer(`Deleted "${line.label}"`, () => sync.track(() => setDoc(refFor(line), line)))
  }

  return { add, save, remove }
}
