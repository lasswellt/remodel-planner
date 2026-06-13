import { query, where } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import type { Task } from '~/models'
import { checklistGroup, tasksGroup } from '~/utils/firestore-paths'
import type { Progress } from '~/utils/rollup'
import {
  effectiveRoomStatus,
  nextOpenTask,
  phaseProgress,
  projectProgress,
  roomProgress,
} from '~/utils/rollup'
import { useProjectStore } from '~/stores/project'

// Reactive face of the one rollup source (app/utils/rollup.ts). Binds the
// current project's tasks + checklist via collection-group queries once —
// createSharedComposable means the floorplan rings, app-bar project ring, and
// task board all read the same two listeners and the same math.
export const useRollup = createSharedComposable(() => {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const scope = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? {
          uid: where('uid', '==', projectStore.activeOwnerUid),
          project: where('projectId', '==', projectStore.currentProjectId),
        }
      : null,
  )

  const tasksSource = computed(() =>
    scope.value ? query(tasksGroup(db), scope.value.uid, scope.value.project) : null,
  )
  const checklistSource = computed(() =>
    scope.value ? query(checklistGroup(db), scope.value.uid, scope.value.project) : null,
  )

  const tasks = useCollection(tasksSource, { ssrKey: 'rollup-tasks' })
  const checklist = useCollection(checklistSource, { ssrKey: 'rollup-checklist' })

  const project = computed<Progress>(() =>
    projectProgress(checklist.value, tasks.value),
  )

  const byRoom = (roomId: string): Progress =>
    roomProgress(roomId, checklist.value, tasks.value)

  const byPhase = computed(() => phaseProgress(tasks.value))

  const nextTask = (roomId: string): Task | null =>
    nextOpenTask(roomId, tasks.value)

  return { tasks, checklist, project, byRoom, byPhase, nextTask, effectiveRoomStatus }
})
