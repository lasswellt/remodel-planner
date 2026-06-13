<script setup lang="ts">
import type { InspirationItem } from '~/models'
import { useResearch } from '~/composables/useResearch'
import { useInspirationOps } from '~/composables/useInspiration'

defineProps<{ item: InspirationItem }>()
const emit = defineEmits<{ edit: [] }>()

const { bySlug } = useResearch()
const ops = useInspirationOps()

const tagLabel = (slug: string) => bySlug[slug]?.title ?? slug
</script>

<template>
  <v-card variant="outlined" class="insp-card h-100 d-flex flex-column">
    <v-img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" :aspect-ratio="16 / 9" cover>
      <template #error>
        <div class="img-fallback"><v-icon icon="mdi-image-off-outline" /></div>
      </template>
    </v-img>
    <div v-else class="img-fallback">
      <v-icon icon="mdi-image-outline" size="32" />
    </div>

    <div class="pa-3 d-flex flex-column flex-grow-1">
      <a :href="item.url" target="_blank" rel="noopener" class="text-body-1 font-weight-medium text-primary text-decoration-none">
        {{ item.title }}
        <v-icon icon="mdi-open-in-new" size="x-small" />
      </a>
      <p v-if="item.notes" class="text-caption text-medium-emphasis mt-1 mb-0">{{ item.notes }}</p>
      <v-spacer />
      <div v-if="item.psychologyTags.length > 0" class="d-flex flex-wrap ga-1 mt-3">
        <v-chip
          v-for="t in item.psychologyTags"
          :key="t"
          size="x-small"
          variant="tonal"
          color="secondary"
          prepend-icon="mdi-brain"
          :to="`/research#${t}`"
        >{{ tagLabel(t) }}</v-chip>
      </div>
      <div class="d-flex justify-end mt-2">
        <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" aria-label="Edit" @click="emit('edit')" />
        <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" aria-label="Remove" @click="ops.remove(item)" />
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.img-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  background: rgba(127, 127, 127, 0.08);
  color: rgba(127, 127, 127, 0.6);
}
</style>
