<script setup lang="ts">
import type { Room } from '~/models'
import { ROOM_TYPE_LABELS } from '~/config/rooms'
import { ROOM_TEMPLATES } from '~/config/templates'

// Compact checklist inside the floorplan summary panel. Items come from the
// shared rollup binding; rows are the shared ChecklistItemRow (toggle +
// psychology popover, no delete — full editing lives on the rooms page).
// Empty state offers the room-type template as a head start (UX2/UX10).
const props = defineProps<{ room: Room }>()

const rollup = useRollup()
const { applyTemplate } = useTemplateApply()

const items = computed(() =>
  rollup.checklist.value
    .filter(item => item.roomId === props.room.id)
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)),
)

const template = computed(() => ROOM_TEMPLATES[props.room.type])
const applying = ref(false)
const applied = ref('')

async function onApply() {
  if (applying.value) return
  applying.value = true
  try {
    const result = await applyTemplate(props.room)
    applied.value = `${ROOM_TYPE_LABELS[props.room.type]} planned — ${result.items} items, ${result.tasks} tasks seeded`
  }
  finally {
    applying.value = false
  }
}
</script>

<template>
  <v-list v-if="items.length > 0" density="compact" class="py-0">
    <RoomsChecklistItemRow v-for="item in items" :key="item.id" :item="item" />
  </v-list>
  <div v-else>
    <p class="text-body-2 text-medium-emphasis mb-2">
      Start with the {{ ROOM_TYPE_LABELS[room.type] }} template —
      {{ template.checklist.length }} items, {{ template.tasks.length }} tasks
      seeded as a head start.
    </p>
    <v-btn
      color="primary"
      size="small"
      variant="tonal"
      prepend-icon="mdi-auto-fix"
      :loading="applying"
      @click="onApply"
    >
      Apply template
    </v-btn>
  </div>
  <v-snackbar
    :model-value="!!applied"
    timeout="6000"
    color="success"
    @update:model-value="(v: boolean) => { if (!v) applied = '' }"
  >
    {{ applied }}
  </v-snackbar>
</template>
