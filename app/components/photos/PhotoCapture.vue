<script setup lang="ts">
import type { PhotoStage } from '~/models'
import { PHOTO_STAGES, PHOTO_STAGE_LABELS } from '~/config/photos'

// Mobile-first capture: tapping the input lets a phone take a photo or pick from
// the library; desktop gets drag-drop. Non-image files are filtered before upload.
const emit = defineEmits<{ files: [File[], PhotoStage] }>()

const stage = ref<PhotoStage>('before')
const dragOver = ref(false)
const input = ref<HTMLInputElement | null>(null)

function imagesOnly(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter(f => f.type.startsWith('image/'))
}
function pick() {
  input.value?.click()
}
function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const files = imagesOnly(el.files)
  if (files.length) emit('files', files, stage.value)
  el.value = ''
}
function onDrop(e: DragEvent) {
  dragOver.value = false
  const files = imagesOnly(e.dataTransfer?.files)
  if (files.length) emit('files', files, stage.value)
}
</script>

<template>
  <div
    class="capture pa-3"
    :class="{ 'capture--over': dragOver }"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="input"
      type="file"
      accept="image/*"
      multiple
      class="d-none"
      @change="onInput"
    >
    <div class="d-flex flex-wrap align-center ga-3">
      <v-btn-toggle v-model="stage" mandatory density="compact" variant="outlined" divided>
        <v-btn v-for="s in PHOTO_STAGES" :key="s" :value="s" size="small">{{ PHOTO_STAGE_LABELS[s] }}</v-btn>
      </v-btn-toggle>
      <v-btn color="primary" prepend-icon="mdi-camera-plus-outline" @click="pick">Add photos</v-btn>
      <span class="text-body-2 text-medium-emphasis">or drop images here</span>
    </div>
  </div>
</template>

<style scoped>
.capture {
  border: 1.5px dashed rgba(127, 127, 127, 0.4);
  border-radius: 8px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.capture--over {
  background: rgba(var(--v-theme-primary), 0.06);
  border-color: rgb(var(--v-theme-primary));
}
</style>
