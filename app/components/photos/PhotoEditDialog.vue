<script setup lang="ts">
import type { Photo, PhotoStage } from '~/models'
import { PHOTO_STAGES, PHOTO_STAGE_LABELS } from '~/config/photos'
import { useProjectTasks } from '~/composables/useTasks'
import { useProjectSelections } from '~/composables/useSelections'
import { usePhotoOps } from '~/composables/usePhotos'

const props = defineProps<{ modelValue: boolean, photo: Photo }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = usePhotoOps()
const tasksApi = useProjectTasks()
const sel = useProjectSelections()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const stage = ref<PhotoStage>('before')
const caption = ref('')
const taskId = ref('')
const selectionId = ref('')

watch(open, (v) => {
  if (!v) return
  stage.value = props.photo.stage
  caption.value = props.photo.caption ?? ''
  taskId.value = props.photo.taskId ?? ''
  selectionId.value = props.photo.selectionId ?? ''
}, { immediate: true })

const stageItems = PHOTO_STAGES.map(s => ({ value: s, title: PHOTO_STAGE_LABELS[s] }))
const taskItems = computed(() => [
  { value: '', title: 'No task' },
  ...tasksApi.tasks.value.filter(t => t.roomId === props.photo.roomId).map(t => ({ value: t.id, title: t.label })),
])
const selectionItems = computed(() => [
  { value: '', title: 'No selection' },
  ...sel.byRoom(props.photo.roomId).map(s => ({ value: s.id, title: s.label })),
])

function save() {
  ops.save({
    id: props.photo.id,
    uid: props.photo.uid,
    projectId: props.photo.projectId,
    roomId: props.photo.roomId,
    storagePath: props.photo.storagePath,
    thumbPath: props.photo.thumbPath,
    takenAt: props.photo.takenAt,
    stage: stage.value,
    ...(props.photo.deletedAt ? { deletedAt: props.photo.deletedAt } : {}),
    ...(caption.value.trim() ? { caption: caption.value.trim() } : {}),
    ...(taskId.value ? { taskId: taskId.value } : {}),
    ...(selectionId.value ? { selectionId: selectionId.value } : {}),
  })
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card>
      <v-card-title>Edit photo</v-card-title>
      <v-card-text>
        <v-select v-model="stage" :items="stageItems" label="Stage" density="comfortable" class="mb-2" />
        <v-text-field v-model="caption" label="Caption (optional)" density="comfortable" class="mb-2" />
        <v-select v-model="taskId" :items="taskItems" label="Link to task (optional)" density="comfortable" class="mb-2" />
        <v-select v-model="selectionId" :items="selectionItems" label="Link to selection (optional)" density="comfortable" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
