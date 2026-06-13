import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import type { Task, TaskPhase, TaskStatus } from '~/models'
import { tasksCol } from '~/utils/firestore-paths'
import type { Blocker } from '~/utils/task-graph'
import { taskBlockers } from '~/utils/task-graph'
import { useProjectSelections } from '~/composables/useSelections'
import { useProjectPermits } from '~/composables/usePermits'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

// Reactive task-gating for the current project. Tasks come from the shared
// rollup (one listener); this adds selection + permit-inspection listeners so
// blockers resolve. createSharedComposable so the board and the floorplan agree.
export const useProjectTasks = createSharedComposable(() => {
  const rollup = useRollup()
  const { selections } = useProjectSelections()
  const { permits, inspections } = useProjectPermits()

  // Narrow to the exact shapes task-graph expects (Map value invariance means a
  // Map<string, Task> won't pass as Map<string, {label,status}>).
  const tasksById = computed(() =>
    new Map(rollup.tasks.value.map(t => [t.id, { label: t.label, status: t.status }])),
  )
  const selectionsById = computed(() =>
    new Map(selections.value.map(s => [s.id, { label: s.label, status: s.status }])),
  )

  function blockersFor(task: Task): Blocker[] {
    return taskBlockers(task, tasksById.value, selectionsById.value, inspections.value)
  }
  function isBlockedTask(task: Task): boolean {
    return blockersFor(task).length > 0
  }

  return { tasks: rollup.tasks, selections, permits, inspections, blockersFor, isBlockedTask }
})

// Optimistic task writes (UX9); deletion is undo-snackbar (UX8).
export function useTaskOps() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const refFor = (task: Task) =>
    doc(tasksCol(db, task.uid, task.projectId, task.roomId), task.id)

  function setStatus(task: Task, status: TaskStatus): void {
    if (task.status === status) return
    void sync.track(() => updateDoc(refFor(task), { status } as UpdateData<Task>))
  }

  function update(task: Task, patch: Partial<Task>): void {
    void sync.track(() => updateDoc(refFor(task), patch as UpdateData<Task>))
  }

  function remove(task: Task): void {
    void sync.track(() => deleteDoc(refFor(task)))
    undo.offer(`Deleted "${task.label}"`, () => sync.track(() => setDoc(refFor(task), task)))
  }

  function add(roomId: string, fields: { label: string, phase: TaskPhase }): void {
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) return
    const ref = doc(tasksCol(db, ownerUid, projectId, roomId))
    const task: Task = {
      id: ref.id,
      uid: ownerUid,
      projectId,
      roomId,
      label: fields.label,
      phase: fields.phase,
      status: 'todo',
      dependsOn: [],
      blockedBySelections: [],
    }
    void sync.track(() => setDoc(ref, task))
  }

  return { setStatus, update, remove, add }
}
