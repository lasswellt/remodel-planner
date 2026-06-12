<script setup lang="ts">
import { doc, updateDoc } from 'firebase/firestore'
import { useCurrentUser, useFirestore } from 'vuefire'
import type { Room } from '~/models'
import { checklistCol } from '~/utils/firestore-paths'
import { useSyncStore } from '~/stores/sync'

// Checklist list inside the room summary panel. Items come from the shared
// rollup binding (no extra listener); toggling done is an optimistic write, so
// the room's progress ring moves the moment you tap (UX1/UX9).
const props = defineProps<{ room: Room }>()

const db = useFirestore()
const user = useCurrentUser()
const sync = useSyncStore()
const rollup = useRollup()

const items = computed(() =>
  rollup.checklist.value
    .filter(item => item.roomId === props.room.id)
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)),
)

async function toggle(itemId: string, done: boolean) {
  if (!user.value) return
  const ref = doc(
    checklistCol(db, user.value.uid, props.room.projectId, props.room.id),
    itemId,
  )
  await sync.track(() => updateDoc(ref, { done }))
}
</script>

<template>
  <v-list v-if="items.length > 0" density="compact" class="py-0">
    <v-list-item
      v-for="item in items"
      :key="item.id"
      :title="item.label"
      :subtitle="item.category"
      @click="toggle(item.id, !item.done)"
    >
      <template #prepend>
        <!-- @click.stop: a tap on the checkbox itself must not also bubble to
             the row @click — that would fire a duplicate Firestore write. -->
        <v-checkbox-btn
          :model-value="item.done"
          density="compact"
          :aria-label="`Mark ${item.label} ${item.done ? 'not done' : 'done'}`"
          @update:model-value="(v: boolean) => toggle(item.id, v)"
          @click.stop
        />
      </template>
    </v-list-item>
  </v-list>
  <p v-else class="text-body-2 text-medium-emphasis ma-0">
    No checklist yet. Room-type templates seed one in the rooms phase.
  </p>
</template>
