import type { TaskPhase } from '~/models'
import { TASK_PHASE_ORDER } from '~/models'

// THE task-gating source (Phase 7). Pure over plain shapes so the board, the
// move-confirm dialog, and unit tests all agree on what blocks a task. A task
// cannot start (move to in-progress) while it has any blocker; the user may
// override with confirm, but the board always surfaces the named reasons (UX6).

export type BlockerType = 'dependency' | 'selection' | 'inspection'
export interface Blocker {
  type: BlockerType
  label: string
}

export interface TaskGraphNode {
  phase: TaskPhase
  dependsOn: string[]
  blockedBySelections: string[]
}
export interface DepLike { label: string, status: string }
export interface SelLike { label: string, status: string }
export interface InspectionLike { label: string, gatePhase: TaskPhase, status: string }

// A selection stops blocking once it has physically arrived.
const ARRIVED: ReadonlySet<string> = new Set(['delivered', 'installed'])

export function taskBlockers(
  task: TaskGraphNode,
  tasksById: Map<string, DepLike>,
  selectionsById: Map<string, SelLike>,
  inspections: InspectionLike[],
): Blocker[] {
  const blockers: Blocker[] = []

  // 1. Predecessor tasks that aren't done yet.
  for (const depId of task.dependsOn) {
    const dep = tasksById.get(depId)
    if (dep && dep.status !== 'done') {
      blockers.push({ type: 'dependency', label: `"${dep.label}" must finish first` })
    }
  }

  // 2. Long-lead selections that haven't arrived (the top schedule killer).
  for (const selId of task.blockedBySelections) {
    const sel = selectionsById.get(selId)
    if (sel && !ARRIVED.has(sel.status)) {
      blockers.push({ type: 'selection', label: `${sel.label} hasn't been delivered` })
    }
  }

  // 3. Inspection gates: an unpassed inspection gating an EARLIER phase blocks
  //    tasks in later phases (rough-in must pass before drywall unblocks).
  const phaseIdx = TASK_PHASE_ORDER.indexOf(task.phase)
  for (const insp of inspections) {
    const gateIdx = TASK_PHASE_ORDER.indexOf(insp.gatePhase)
    if (gateIdx > -1 && gateIdx < phaseIdx && insp.status !== 'passed') {
      blockers.push({
        type: 'inspection',
        label: `${insp.label} (${insp.gatePhase} inspection) must pass first`,
      })
    }
  }

  return blockers
}

export function isBlocked(
  task: TaskGraphNode,
  tasksById: Map<string, DepLike>,
  selectionsById: Map<string, SelLike>,
  inspections: InspectionLike[],
): boolean {
  return taskBlockers(task, tasksById, selectionsById, inspections).length > 0
}
