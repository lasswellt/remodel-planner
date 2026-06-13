<script setup lang="ts">
import type { Task, TaskStatus } from '~/models'
import { TASK_PHASE_LABELS } from '~/config/tasks'
import { useProjectTasks } from '~/composables/useTasks'

// A draggable task card. Blocked tasks (unmet dependency/selection/inspection
// gates) are the most salient items on the board — warning tone + lock icon +
// the named reasons (UX6). Color is never the only channel.
const props = defineProps<{ task: Task, roomName?: string }>()
const emit = defineEmits<{
  requestMove: [TaskStatus]
  edit: []
  remove: []
  dragstart: []
  dragend: []
}>()

const tasks = useProjectTasks()
const blockers = computed(() => tasks.blockersFor(props.task))
const blocked = computed(() => blockers.value.length > 0)

const moveTargets: { status: TaskStatus, title: string }[] = [
  { status: 'todo', title: 'To do' },
  { status: 'in-progress', title: 'In progress' },
  { status: 'done', title: 'Done' },
]
</script>

<template>
  <v-card
    :variant="blocked ? 'tonal' : 'outlined'"
    :color="blocked ? 'warning' : undefined"
    class="task-card mb-2"
    draggable="true"
    @dragstart="emit('dragstart')"
    @dragend="emit('dragend')"
  >
    <div class="pa-2">
      <div class="d-flex align-center ga-1">
        <v-icon v-if="blocked" icon="mdi-lock-outline" size="small" color="warning" aria-label="Blocked" />
        <span class="text-body-2 font-weight-medium flex-grow-1">{{ task.label }}</span>
        <v-menu>
          <template #activator="{ props: menu }">
            <v-btn icon="mdi-dots-vertical" size="x-small" variant="text" v-bind="menu" aria-label="Task actions" />
          </template>
          <v-list density="compact">
            <v-list-item title="Edit…" prepend-icon="mdi-pencil-outline" @click="emit('edit')" />
            <v-divider />
            <v-list-subheader>Move to</v-list-subheader>
            <v-list-item
              v-for="t in moveTargets"
              :key="t.status"
              :title="t.title"
              :disabled="t.status === task.status"
              @click="emit('requestMove', t.status)"
            />
            <v-divider />
            <v-list-item title="Delete" prepend-icon="mdi-delete-outline" base-color="error" @click="emit('remove')" />
          </v-list>
        </v-menu>
      </div>
      <div class="d-flex align-center ga-1 mt-1 flex-wrap">
        <v-chip size="x-small" variant="tonal">{{ TASK_PHASE_LABELS[task.phase] }}</v-chip>
        <v-chip v-if="roomName" size="x-small" variant="text" prepend-icon="mdi-floor-plan">{{ roomName }}</v-chip>
        <v-chip v-if="task.dueDate" size="x-small" variant="text" prepend-icon="mdi-calendar-outline">{{ task.dueDate }}</v-chip>
      </div>
      <ul v-if="blocked" class="blockers mt-1">
        <li v-for="(b, i) in blockers" :key="i" class="text-caption">{{ b.label }}</li>
      </ul>
    </div>
  </v-card>
</template>

<style scoped>
.task-card {
  cursor: grab;
}
.task-card:active {
  cursor: grabbing;
}
.blockers {
  margin: 0;
  padding-left: 18px;
  opacity: 0.9;
}
</style>
