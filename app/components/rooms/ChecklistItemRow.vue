<script setup lang="ts">
import type { ChecklistItem } from '~/models'

// One checklist row, shared by the rooms page and the floorplan summary
// panel. Toggle is optimistic; removal (when enabled) is undo-snackbar (UX8).
const props = defineProps<{
  item: ChecklistItem
  removable?: boolean
}>()

const ops = useChecklistOps()

function toggle() {
  ops.toggle(props.item, !props.item.done)
}
</script>

<template>
  <v-list-item :title="item.label" :subtitle="item.notes" @click="toggle">
    <template #prepend>
      <!-- @click.stop: a tap on the checkbox must not also bubble to the row
           click — that would fire a duplicate write. -->
      <v-checkbox-btn
        :model-value="item.done"
        density="compact"
        :aria-label="`Mark ${item.label} ${item.done ? 'not done' : 'done'}`"
        @update:model-value="(v: boolean) => ops.toggle(item, v)"
        @click.stop
      />
    </template>
    <template #append>
      <PsychologyPopover v-if="item.psychologyTag" :tag="item.psychologyTag" />
      <v-btn
        v-if="removable"
        icon="mdi-delete-outline"
        size="x-small"
        variant="text"
        :aria-label="`Delete ${item.label}`"
        @click.stop="ops.remove(item)"
      />
    </template>
  </v-list-item>
</template>
