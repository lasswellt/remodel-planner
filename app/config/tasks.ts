import type { TaskPhase, TaskStatus } from '~/models'
import { TaskPhase as TaskPhaseEnum } from '~/models'

// Display names for the real remodel sequence (enums.ts TaskPhase order is
// significant — it drives phase rollups and inspection gating).
export const TASK_PHASE_LABELS: Record<TaskPhase, string> = {
  'demo': 'Demo',
  'rough-in': 'Rough-in',
  'insulation': 'Insulation',
  'drywall': 'Drywall',
  'paint': 'Paint',
  'flooring': 'Flooring',
  'trim': 'Trim',
  'fixtures': 'Fixtures',
  'punch-list': 'Punch list',
}

export const TASK_PHASE_OPTIONS = TaskPhaseEnum.options.map(value => ({
  value,
  title: TASK_PHASE_LABELS[value],
}))

// The board's draggable columns. 'blocked' is derived from unmet gates (not a
// column) and rendered with salience wherever the task sits (UX6).
export const BOARD_COLUMNS: { status: TaskStatus, title: string, icon: string }[] = [
  { status: 'todo', title: 'To do', icon: 'mdi-circle-outline' },
  { status: 'in-progress', title: 'In progress', icon: 'mdi-progress-wrench' },
  { status: 'done', title: 'Done', icon: 'mdi-check-circle-outline' },
]

// A stored 'blocked' status lands in the To-do column (it's not-yet-started
// work); everything else maps to its own column.
export function columnFor(status: TaskStatus): TaskStatus {
  return status === 'blocked' ? 'todo' : status
}
