import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { Inspection, Permit, PermitStatus } from '~/models'
import { permitsCol } from '~/utils/firestore-paths'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// THE permits listener for the current project (project-level collection,
// member-aware). createSharedComposable so the permits page, the budget rollup
// (fees), and the task-gating composable (inspection gates) all read one
// binding (useTasks + useBudget consume this).
export const useProjectPermits = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? permitsCol(db, projectStore.activeOwnerUid, projectStore.currentProjectId)
      : null,
  )
  const permits = useCollection<Permit>(source, { ssrKey: 'permits' })

  const inspections = computed(() => permits.value.flatMap(p => p.inspections))
  const totalFeesCents = computed(() => permits.value.reduce((s, p) => s + (p.feeCents ?? 0), 0))
  const failedInspections = computed(() =>
    permits.value.flatMap(p => p.inspections.filter(i => i.status === 'failed').map(i => ({ permit: p, inspection: i }))),
  )

  return { permits, inspections, totalFeesCents, failedInspections }
})

export type NewPermitFields = Omit<Permit, 'id' | 'uid' | 'projectId'>

export function usePermitOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (p: Permit) => doc(permitsCol(db, p.uid, p.projectId), p.id)

  function add(fields: NewPermitFields): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(permitsCol(db, ownerUid, projectId))
    const permit: Permit = { id: ref.id, uid: ownerUid, projectId, ...fields }
    void sync.track(() => setDoc(ref, permit))
  }

  function save(permit: Permit): void {
    void sync.track(() => setDoc(refFor(permit), permit))
  }

  function remove(permit: Permit): void {
    void sync.track(() => deleteDoc(refFor(permit)))
    undo.offer(`Deleted permit "${permit.scope}"`, () => sync.track(() => setDoc(refFor(permit), permit)))
  }

  function setStatus(permit: Permit, status: PermitStatus): void {
    if (permit.status === status) return
    void sync.track(() => updateDoc(refFor(permit), { status } as UpdateData<Permit>))
  }

  // Inspections are embedded in the permit doc; mutate by rewriting the array.
  function writeInspections(permit: Permit, inspections: Inspection[]): void {
    void sync.track(() => updateDoc(refFor(permit), { inspections } as UpdateData<Permit>))
  }

  function upsertInspection(permit: Permit, inspection: Inspection): void {
    const exists = permit.inspections.some(i => i.id === inspection.id)
    const next = exists
      ? permit.inspections.map(i => (i.id === inspection.id ? inspection : i))
      : [...permit.inspections, inspection]
    writeInspections(permit, next)
  }

  function removeInspection(permit: Permit, inspectionId: string): void {
    writeInspections(permit, permit.inspections.filter(i => i.id !== inspectionId))
  }

  return { add, save, remove, setStatus, upsertInspection, removeInspection }
}
