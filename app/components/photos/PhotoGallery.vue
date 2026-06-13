<script setup lang="ts">
import type { Photo, PhotoStage, Room } from '~/models'
import { PHOTO_STAGES, PHOTO_STAGE_LABELS } from '~/config/photos'
import { useRoomPhotos, usePhotoUpload } from '~/composables/usePhotos'

const props = defineProps<{ room: Room }>()

const { photos, byStage } = useRoomPhotos(() => props.room.id)
const upload = usePhotoUpload()

function onFiles(files: File[], stage: PhotoStage) {
  for (const f of files) upload.start(props.room, f, stage)
}

const editing = ref<Photo | null>(null)
const editOpen = ref(false)
function openEdit(p: Photo) {
  editing.value = p
  editOpen.value = true
}

// UX11: pair before[i] with after[i] for side-by-side comparison.
const beforeAfter = computed(() => {
  const before = byStage('before')
  const after = byStage('after')
  if (before.length === 0 || after.length === 0) return []
  const n = Math.max(before.length, after.length)
  return Array.from({ length: n }, (_, i) => ({ before: before[i] ?? null, after: after[i] ?? null }))
})
</script>

<template>
  <div>
    <PhotosPhotoCapture class="mb-3" @files="onFiles" />

    <!-- UX9: optimistic uploads with per-item progress; failures retry. -->
    <div v-if="upload.uploads.value.length > 0" class="mb-4">
      <v-card
        v-for="u in upload.uploads.value"
        :key="u.id"
        variant="tonal"
        :color="u.status === 'error' ? 'error' : undefined"
        class="mb-1"
      >
        <div class="pa-2 d-flex align-center ga-2">
          <v-icon
            :icon="u.status === 'error' ? 'mdi-alert' : u.status === 'done' ? 'mdi-check-circle-outline' : 'mdi-cloud-upload-outline'"
            size="small"
          />
          <span class="text-body-2 flex-grow-1 text-truncate">{{ u.fileName }}</span>
          <v-progress-linear
            v-if="u.status === 'uploading'"
            :model-value="u.progress * 100"
            style="max-width: 120px"
            rounded
            color="primary"
          />
          <template v-else-if="u.status === 'error'">
            <span class="text-caption">{{ u.error }}</span>
            <v-btn size="x-small" variant="text" @click="upload.retry(u)">Retry</v-btn>
            <v-btn size="x-small" variant="text" @click="upload.dismiss(u)">Dismiss</v-btn>
          </template>
        </div>
      </v-card>
    </div>

    <!-- UX11: before/after side-by-side -->
    <div v-if="beforeAfter.length > 0" class="mb-4">
      <div class="text-body-2 font-weight-medium mb-2">Before / after</div>
      <div v-for="(pair, i) in beforeAfter" :key="i" class="ba-row mb-2">
        <div class="ba-cell">
          <PhotosPhotoThumb v-if="pair.before" :photo="pair.before!" @edit="openEdit(pair.before!)" />
          <div v-else class="ba-empty text-caption text-medium-emphasis">No before photo</div>
        </div>
        <v-icon icon="mdi-arrow-right" class="ba-arrow" />
        <div class="ba-cell">
          <PhotosPhotoThumb v-if="pair.after" :photo="pair.after!" @edit="openEdit(pair.after!)" />
          <div v-else class="ba-empty text-caption text-medium-emphasis">No after photo</div>
        </div>
      </div>
    </div>

    <!-- Stage grids -->
    <template v-if="photos.length > 0">
      <template v-for="s in PHOTO_STAGES" :key="s">
        <div v-if="byStage(s).length > 0">
          <div class="text-body-2 font-weight-medium mb-2 mt-2">{{ PHOTO_STAGE_LABELS[s] }}</div>
          <v-row>
            <v-col v-for="p in byStage(s)" :key="p.id" cols="6" sm="4" md="3">
              <PhotosPhotoThumb :photo="p" @edit="openEdit(p)" />
            </v-col>
          </v-row>
        </div>
      </template>
    </template>
    <p v-else class="text-body-2 text-medium-emphasis">
      No photos yet. Capture "before" shots now — they're the most valuable and the easiest to forget.
    </p>

    <PhotosPhotoEditDialog v-if="editing" v-model="editOpen" :photo="editing" />
  </div>
</template>

<style scoped>
.ba-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}
.ba-cell {
  min-width: 0;
}
.ba-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px dashed rgba(127, 127, 127, 0.3);
  border-radius: 8px;
}
.ba-arrow {
  justify-self: center;
}
</style>
