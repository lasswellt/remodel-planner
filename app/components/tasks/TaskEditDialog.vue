<script setup lang="ts">
import type { Task, TaskPhase } from '~/models'
import { TASK_PHASE_OPTIONS } from '~/config/tasks'
import { useProjectTasks, useTaskOps } from '~/composables/useTasks'
import { useProjectItems } from '~/composables/useItems'

// Edit a task's label, phase, due date, predecessors (dependsOn) and blocking
// items. Candidates are scoped to the task's own room. This is where the
// template-seeded dependencies become editable (Phase 7) and where a task is
// wired to the long-lead items that gate it (Phase 8).
const props = defineProps<{ modelValue: boolean, task: Task }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = useTaskOps()
const tasksApi = useProjectTasks()
const items = useProjectItems()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const label = ref('')
const phase = ref<TaskPhase>('demo')
const dueDate = ref('')
const dependsOn = ref<string[]>([])
const blockedBySelections = ref<string[]>([])

watch(open, (v) => {
  if (!v) return
  label.value = props.task.label
  phase.value = props.task.phase
  dueDate.value = props.task.dueDate ?? ''
  dependsOn.value = [...props.task.dependsOn]
  blockedBySelections.value = [...props.task.blockedBySelections]
}, { immediate: true })

const depItems = computed(() =>
  tasksApi.tasks.value
    .filter(t => t.roomId === props.task.roomId && t.id !== props.task.id)
    .map(t => ({ value: t.id, title: t.label })),
)
const selItems = computed(() =>
  items.byRoom(props.task.roomId).map(i => ({ value: i.id, title: `${i.label} · ${i.status}` })),
)

const valid = computed(() => !!label.value.trim())

function save() {
  if (!valid.value) return
  ops.update(props.task, {
    label: label.value.trim(),
    phase: phase.value,
    dependsOn: dependsOn.value,
    blockedBySelections: blockedBySelections.value,
    ...(dueDate.value ? { dueDate: dueDate.value } : {}),
  })
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card>
      <v-card-title>Edit task</v-card-title>
      <v-card-text>
        <v-text-field v-model="label" label="Task" density="comfortable" autofocus class="mb-2" />
        <div class="d-flex ga-2">
          <v-select v-model="phase" :items="TASK_PHASE_OPTIONS" label="Phase" density="comfortable" class="mb-2" />
          <v-text-field v-model="dueDate" label="Due date" type="date" density="comfortable" class="mb-2" />
        </div>
        <v-select
          v-model="dependsOn"
          :items="depItems"
          label="Depends on (must finish first)"
          multiple
          chips
          closable-chips
          density="comfortable"
          class="mb-2"
          no-data-text="No other tasks in this room"
        />
        <v-select
          v-model="blockedBySelections"
          :items="selItems"
          label="Blocked by items (until delivered)"
          multiple
          chips
          closable-chips
          density="comfortable"
          no-data-text="No items in this room yet"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
