<script setup lang="ts">
import { ref as storageRef } from 'firebase/storage'
import { useFirebaseStorage, useStorageFileUrl } from 'vuefire'
import type { Photo } from '~/models'
import { PHOTO_STAGE_COLOR, PHOTO_STAGE_LABELS } from '~/config/photos'
import { usePhotoOps } from '~/composables/usePhotos'

const props = defineProps<{ photo: Photo, showStage?: boolean }>()
const emit = defineEmits<{ edit: [] }>()

const storage = useFirebaseStorage()
const ops = usePhotoOps()

// Thumb-first: the gallery shows the small thumbnail; the full original is only
// fetched on demand (the gallery lazy-loads, keeping the initial payload light).
const { url } = useStorageFileUrl(computed(() => storageRef(storage, props.photo.thumbPath)))
</script>

<template>
  <v-card variant="outlined" class="photo-thumb">
    <v-img :src="url ?? undefined" :alt="photo.caption || 'Project photo'" :aspect-ratio="1" cover>
      <template #placeholder>
        <div class="d-flex align-center justify-center fill-height">
          <v-progress-circular indeterminate size="22" color="primary" />
        </div>
      </template>
    </v-img>
    <div class="pa-2">
      <div class="d-flex align-center ga-1">
        <v-chip
          v-if="showStage"
          :color="PHOTO_STAGE_COLOR[photo.stage]"
          size="x-small"
          variant="flat"
        >{{ PHOTO_STAGE_LABELS[photo.stage] }}</v-chip>
        <v-spacer />
        <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" aria-label="Edit photo" @click="emit('edit')" />
        <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" aria-label="Delete photo" @click="ops.softDelete(photo)" />
      </div>
      <p v-if="photo.caption" class="text-caption mt-1 mb-0">{{ photo.caption }}</p>
    </div>
  </v-card>
</template>

<style scoped>
.photo-thumb {
  overflow: hidden;
}
</style>
