import { deleteDoc, doc, query, setDoc, where } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { Expense } from '~/models'
import { expensesCol, expensesGroup } from '~/utils/firestore-paths'
import { ledgerSummary, spentByRoom } from '~/utils/ledger-math'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// Reactive spending-ledger rollup for the current project. createSharedComposable
// means the room ledger sections and the budget "Spent (actual)" stat read one
// collection-group listener and the same ledger-math.ts numbers. Mirrors
// useProjectBudget.
export const useProjectLedger = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? query(
          expensesGroup(db),
          where('uid', '==', projectStore.activeOwnerUid),
          where('projectId', '==', projectStore.currentProjectId),
        )
      : null,
  )
  const expenses = useCollection<Expense>(source, { ssrKey: 'expenses' })

  // Bucket by room once per data change so the per-room sections and budget
  // rollup don't each re-scan the full expense list (O(rooms × expenses)).
  const expensesByRoom = computed(() => {
    const m = new Map<string, Expense[]>()
    for (const e of expenses.value) {
      const g = m.get(e.roomId)
      if (g) g.push(e)
      else m.set(e.roomId, [e])
    }
    return m
  })

  const forRoom = (roomId: string) => expensesByRoom.value.get(roomId) ?? []
  const roomTotalCents = (roomId: string) =>
    forRoom(roomId).reduce((sum, e) => sum + e.amountCents, 0)
  const summary = computed(() => ledgerSummary(expenses.value))
  const totalCents = computed(() => summary.value.totalCents)
  const spentByRoomMap = (roomIds: string[]) => spentByRoom(expenses.value, roomIds)

  return { expenses, forRoom, roomTotalCents, summary, totalCents, spentByRoomMap }
})

export type NewExpenseFields = Omit<Expense, 'id' | 'uid' | 'projectId' | 'roomId'>

// Optimistic ledger writes (UX9). Deletion is undo-snackbar, not confirm (UX8).
// Mirrors useBudgetOps.
export function useLedgerOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (e: Expense) =>
    doc(expensesCol(db, e.uid, e.projectId, e.roomId), e.id)

  function add(roomId: string, fields: NewExpenseFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(expensesCol(db, ownerUid, projectId, roomId))
    const expense: Expense = { id: ref.id, uid: ownerUid, projectId, roomId, ...fields }
    void sync.track(() => setDoc(ref, expense))
  }

  // Full-doc replace (converter validates on write); the dialog passes the
  // edited expense with its existing id, so create/edit share one path.
  function save(expense: Expense): void {
    void sync.track(() => setDoc(refFor(expense), expense))
  }

  function remove(expense: Expense): void {
    void sync.track(() => deleteDoc(refFor(expense)))
    undo.offer(`Deleted "${expense.label}"`, () => sync.track(() => setDoc(refFor(expense), expense)))
  }

  return { add, save, remove }
}
