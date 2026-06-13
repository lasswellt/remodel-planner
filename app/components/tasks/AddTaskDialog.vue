<script setup lang="ts">
import type { Room, TaskPhase } from '~/models'
import { TASK_PHASE_OPTIONS } from '~/config/tasks'
import { useTaskOps } from '~/composables/useTasks'

const props = defineProps<{ modelValue: boolean, rooms: Room[], defaultRoomId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = useTaskOps()
const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const label = ref('')
const phase = ref<TaskPhase>('demo')
const roomId = ref('')

watch(open, (v) => {
  if (!v) return
  label.value = ''
  phase.value = 'demo'
  roomId.value = props.defaultRoomId ?? props.rooms[0]?.id ?? ''
}, { immediate: true })

const roomItems = computed(() => props.rooms.map(r => ({ value: r.id, title: r.name })))
const valid = computed(() => !!label.value.trim() && !!roomId.value)

function save() {
  if (!valid.value) return
  ops.add(roomId.value, { label: label.value.trim(), phase: phase.value })
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card>
      <v-card-title>Add task</v-card-title>
      <v-card-text>
        <v-text-field v-model="label" label="Task" density="comfortable" autofocus class="mb-2" />
        <v-select v-model="roomId" :items="roomItems" label="Room" density="comfortable" class="mb-2" />
        <v-select v-model="phase" :items="TASK_PHASE_OPTIONS" label="Phase" density="comfortable" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">Add task</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
