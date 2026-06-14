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
  roomProgressMap,
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

  // One memoized pass feeds every per-room ring (floorplan v-for, room cards,
  // panels). byRoom is an O(1) lookup so the floorplan's room loop no longer
  // re-scans the whole project per room on each render/drag frame.
  const progressByRoom = computed(() => roomProgressMap(checklist.value, tasks.value))
  const EMPTY_PROGRESS: Progress = { done: 0, total: 0, pct: 0, complete: false }

  const byRoom = (roomId: string): Progress =>
    progressByRoom.value.get(roomId) ?? EMPTY_PROGRESS

  const byPhase = computed(() => phaseProgress(tasks.value))

  const nextTask = (roomId: string): Task | null =>
    nextOpenTask(roomId, tasks.value)

  return { tasks, checklist, project, byRoom, byPhase, nextTask, effectiveRoomStatus }
})
