<script setup lang="ts">
import type { Room } from '~/models'
import { ROOM_TYPE_ICONS, ROOM_TYPE_LABELS } from '~/config/rooms'
import { dimsLabel, sqFt } from '~/utils/geometry'
import { ROOM_TEMPLATES } from '~/config/templates'

// Room card on the rooms grid: progress ring always visible (UX1), template
// state framed as a head start ("12 items planned"), never an empty burden
// (UX2). Click-through to the room detail.
const props = defineProps<{ room: Room }>()

const rollup = useRollup()
const progress = computed(() => rollup.byRoom(props.room.id))
const itemCount = computed(
  () => rollup.checklist.value.filter(c => c.roomId === props.room.id).length,
)
const taskCount = computed(
  () => rollup.tasks.value.filter(t => t.roomId === props.room.id).length,
)
const template = computed(() => ROOM_TEMPLATES[props.room.type])
</script>

<template>
  <v-card :to="`/rooms/${room.id}`" hover>
    <v-card-item>
      <template #prepend>
        <v-icon :icon="ROOM_TYPE_ICONS[room.type]" size="28" />
      </template>
      <v-card-title>{{ room.name }}</v-card-title>
      <v-card-subtitle>
        {{ ROOM_TYPE_LABELS[room.type] }} · {{ dimsLabel(room.geometry) }} ({{ sqFt(room.geometry) }} sq ft) · floor {{ room.floor }}
      </v-card-subtitle>
      <template #append>
        <v-progress-circular
          :model-value="progress.pct"
          :color="progress.complete ? 'success' : 'primary'"
          size="42"
          width="4"
          :aria-label="`${room.name} progress ${progress.pct}%`"
        >
          <span class="text-caption">{{ progress.pct }}</span>
        </v-progress-circular>
      </template>
    </v-card-item>
    <v-card-text class="pt-0">
      <template v-if="itemCount > 0">
        <v-chip size="small" variant="tonal" prepend-icon="mdi-format-list-checks" class="mr-2">
          {{ itemCount }} items planned
        </v-chip>
        <v-chip v-if="taskCount > 0" size="small" variant="tonal" prepend-icon="mdi-hammer-wrench">
          {{ taskCount }} tasks
        </v-chip>
      </template>
      <span v-else class="text-body-2 text-medium-emphasis">
        Start with the {{ ROOM_TYPE_LABELS[room.type] }} template —
        {{ template.checklist.length }} items, {{ template.tasks.length }} tasks
      </span>
    </v-card-text>
  </v-card>
</template>
