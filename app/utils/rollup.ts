import type { RoomStatus, TaskPhase } from '~/models'
import { TASK_PHASE_ORDER } from '~/models'

// THE one rollup source (Build Conventions). Every progress number in the app
// — floorplan rect rings, app-bar project ring, task-board phase bars — comes
// from these functions via the useRollup composable, so they cannot disagree.
// Pure over plain arrays; reactive wiring lives in composables/useRollup.ts.

export interface ChecklistLike {
  roomId: string
  done: boolean
}
export interface TaskLike {
  roomId: string
  phase: TaskPhase
  status: string
}

export interface Progress {
  done: number
  total: number
  /** 0-100, floored so progress never reads 100 before everything is done. */
  pct: number
  complete: boolean
}

function progress(done: number, total: number): Progress {
  return {
    done,
    total,
    pct: total === 0 ? 0 : Math.floor((done / total) * 100),
    complete: total > 0 && done === total,
  }
}

// Room progress counts checklist items and tasks together: planning work and
// execution work both move the ring (UX1/UX2).
export function roomProgress(
  roomId: string,
  checklist: ChecklistLike[],
  tasks: TaskLike[],
): Progress {
  let done = 0
  let total = 0
  for (const item of checklist) {
    if (item.roomId !== roomId) continue
    total++
    if (item.done) done++
  }
  for (const task of tasks) {
    if (task.roomId !== roomId) continue
    total++
    if (task.status === 'done') done++
  }
  return progress(done, total)
}

export function projectProgress(
  checklist: ChecklistLike[],
  tasks: TaskLike[],
): Progress {
  let done = 0
  const total = checklist.length + tasks.length
  for (const item of checklist) if (item.done) done++
  for (const task of tasks) if (task.status === 'done') done++
  return progress(done, total)
}

// Tasks only — checklists have no phase. Feeds the Phase 7 board bars.
export function phaseProgress(tasks: TaskLike[]): Record<TaskPhase, Progress> {
  const out = {} as Record<TaskPhase, Progress>
  for (const phase of TASK_PHASE_ORDER) {
    const inPhase = tasks.filter(t => t.phase === phase)
    out[phase] = progress(
      inPhase.filter(t => t.status === 'done').length,
      inPhase.length,
    )
  }
  return out
}

// A room at 100% renders done regardless of its stored status (UX3); otherwise
// the stored status (user-settable) wins.
export function effectiveRoomStatus(stored: RoomStatus, p: Progress): RoomStatus {
  return p.complete ? 'done' : stored
}

// Earliest open task by remodel sequencing — the "next task" on a room summary.
export function nextOpenTask<T extends TaskLike>(roomId: string, tasks: T[]): T | null {
  const open = tasks.filter(t => t.roomId === roomId && t.status !== 'done')
  if (open.length === 0) return null
  open.sort(
    (a, b) =>
      TASK_PHASE_ORDER.indexOf(a.phase) - TASK_PHASE_ORDER.indexOf(b.phase),
  )
  return open[0]!
}
