<script setup lang="ts">
import type { Task, TaskStatus } from '~/models'
import { BOARD_COLUMNS, columnFor } from '~/config/tasks'
import { useProjectTasks, useTaskOps } from '~/composables/useTasks'
import { useRoomsStore } from '~/stores/rooms'

// Kanban by status. A task moves via drag (desktop) or the card menu (mobile);
// both funnel through move(), which enforces the gate: a blocked task can't
// enter "In progress" without a confirm override (UX8 reserves confirm for
// genuinely consequential actions — working ahead of an unmet gate is one).
const props = defineProps<{ tasks: Task[], showRoom?: boolean }>()

const tasksApi = useProjectTasks()
const ops = useTaskOps()
const roomsStore = useRoomsStore()

const byColumn = (status: TaskStatus) =>
  props.tasks.filter(t => columnFor(t.status) === status)

const dragged = ref<Task | null>(null)
const dragOverCol = ref<TaskStatus | null>(null)

const blockerDialog = ref(false)
const pending = ref<{ task: Task, status: TaskStatus } | null>(null)
const pendingBlockers = computed(() =>
  pending.value ? tasksApi.blockersFor(pending.value.task) : [],
)

function move(task: Task, status: TaskStatus) {
  if (task.status === status) return
  if (status === 'in-progress' && tasksApi.isBlockedTask(task)) {
    pending.value = { task, status }
    blockerDialog.value = true
    return
  }
  ops.setStatus(task, status)
}

function confirmOverride() {
  if (pending.value) ops.setStatus(pending.value.task, pending.value.status)
  blockerDialog.value = false
  pending.value = null
}

function onDrop(status: TaskStatus) {
  const t = dragged.value
  dragOverCol.value = null
  dragged.value = null
  if (t) move(t, status)
}
</script>

<template>
  <div class="board">
    <div
      v-for="col in BOARD_COLUMNS"
      :key="col.status"
      class="col"
      :class="{ 'col--over': dragOverCol === col.status }"
      @dragover.prevent="dragOverCol = col.status"
      @dragleave="dragOverCol = null"
      @drop="onDrop(col.status)"
    >
      <div class="col-head text-body-2 font-weight-medium">
        <v-icon :icon="col.icon" size="small" />
        {{ col.title }}
        <v-chip size="x-small" variant="tonal" class="ml-1">{{ byColumn(col.status).length }}</v-chip>
      </div>
      <TasksTaskCard
        v-for="task in byColumn(col.status)"
        :key="task.id"
        :task="task"
        :room-name="showRoom ? roomsStore.roomById[task.roomId]?.name : undefined"
        @dragstart="dragged = task"
        @dragend="dragged = null"
        @request-move="(s) => move(task, s)"
        @remove="ops.remove(task)"
      />
      <p v-if="byColumn(col.status).length === 0" class="text-caption text-medium-emphasis pa-2 ma-0">
        Nothing here yet.
      </p>
    </div>

    <v-dialog v-model="blockerDialog" max-width="440">
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon icon="mdi-lock-alert-outline" color="warning" />
          This task is blocked
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-2">Starting it now means working ahead of:</p>
          <ul class="pl-4">
            <li v-for="(b, i) in pendingBlockers" :key="i" class="text-body-2">{{ b.label }}</li>
          </ul>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="blockerDialog = false">Keep waiting</v-btn>
          <v-btn color="warning" @click="confirmOverride">Start anyway</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  align-items: start;
}
.col {
  background: rgba(127, 127, 127, 0.06);
  border-radius: 8px;
  padding: 8px;
  min-height: 120px;
  transition: background 0.15s ease;
}
.col--over {
  background: rgba(127, 127, 127, 0.16);
  outline: 2px dashed rgba(127, 127, 127, 0.4);
}
.col-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 8px;
}
@media (max-width: 720px) {
  .board {
    grid-template-columns: 1fr;
  }
}
</style>
