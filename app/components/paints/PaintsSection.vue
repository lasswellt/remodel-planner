<script setup lang="ts">
import type { Paint, Room } from '~/models'
import { PAINT_FINISH_LABELS, PAINT_SURFACE_LABELS } from '~/config/paints'
import { usePaintOps, useRoomPaints } from '~/composables/usePaints'

const props = defineProps<{ room: Room }>()

const { paints } = useRoomPaints(() => props.room.id)
const ops = usePaintOps()

const items = computed(() => [...paints.value].sort((a, b) => a.name.localeCompare(b.name)))

const dialogOpen = ref(false)
const editing = ref<Paint | undefined>(undefined)
function openAdd() {
  editing.value = undefined
  dialogOpen.value = true
}
function openEdit(p: Paint) {
  editing.value = p
  dialogOpen.value = true
}

function subtitle(p: Paint): string {
  return [
    p.brand,
    p.code,
    p.finish ? PAINT_FINISH_LABELS[p.finish] : null,
    p.surface ? PAINT_SURFACE_LABELS[p.surface] : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-2">
      <span class="text-body-2 text-medium-emphasis">{{ items.length }} color{{ items.length === 1 ? '' : 's' }}</span>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openAdd">Add color</v-btn>
    </div>

    <v-list v-if="items.length > 0" density="compact" class="py-0">
      <v-list-item v-for="p in items" :key="p.id" class="px-2">
        <template #prepend>
          <div
            class="paint-swatch mr-3"
            :class="{ 'paint-swatch--empty': !p.hex }"
            :style="p.hex ? { background: p.hex } : undefined"
            :title="p.hex || 'No swatch'"
          >
            <v-icon v-if="!p.hex" icon="mdi-format-color-fill" size="16" />
          </div>
        </template>
        <v-list-item-title>{{ p.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="subtitle(p)">{{ subtitle(p) }}</v-list-item-subtitle>
        <v-list-item-subtitle v-if="p.notes" class="text-medium-emphasis">{{ p.notes }}</v-list-item-subtitle>
        <template #append>
          <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" aria-label="Edit" @click="openEdit(p)" />
          <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" aria-label="Delete" @click="ops.remove(p)" />
        </template>
      </v-list-item>
    </v-list>

    <div v-else class="text-body-2 text-medium-emphasis">
      No paint colors yet. Track the brand, code, finish, and a swatch for each surface in this room.
    </div>

    <PaintsPaintDialog v-model="dialogOpen" :room="room" :paint="editing" />
  </div>
</template>

<style scoped>
.paint-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(127, 127, 127, 0.7);
  flex: 0 0 auto;
}
.paint-swatch--empty {
  background: repeating-conic-gradient(rgba(127, 127, 127, 0.12) 0% 25%, transparent 0% 50%) 50% / 12px 12px;
}
</style>
