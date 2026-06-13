<script setup lang="ts">
import type { InspirationItem, RoomType } from '~/models'
import { ROOM_TYPE_LABELS } from '~/config/rooms'
import {
  inspirationSeedsForType,
  useInspirationOps,
  useProjectInspiration,
} from '~/composables/useInspiration'

const props = defineProps<{ roomType: RoomType }>()

const insp = useProjectInspiration()
const ops = useInspirationOps()

const items = computed(() => insp.byRoomType(props.roomType))
const seedCount = computed(() => inspirationSeedsForType(props.roomType).length)

const dialogOpen = ref(false)
const editing = ref<InspirationItem | undefined>(undefined)
function openAdd() {
  editing.value = undefined
  dialogOpen.value = true
}
function openEdit(i: InspirationItem) {
  editing.value = i
  dialogOpen.value = true
}

function importSeeds() {
  const existing = new Set(items.value.map(i => i.url))
  ops.importSeeds(props.roomType, existing)
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-2 mb-3">
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-link-plus" @click="openAdd">Add by URL</v-btn>
      <v-btn
        v-if="seedCount > 0 && items.length > 0"
        variant="text"
        prepend-icon="mdi-import"
        @click="importSeeds"
      >Import {{ seedCount }} researched ideas</v-btn>
    </div>

    <v-row v-if="items.length > 0">
      <v-col v-for="i in items" :key="i.id" cols="12" sm="6" md="4">
        <InspirationCard :item="i" @edit="openEdit(i)" />
      </v-col>
    </v-row>

    <!-- UX10: empty gallery offers one-click import from the researched index. -->
    <v-empty-state
      v-else
      icon="mdi-image-multiple-outline"
      :title="`No ${ROOM_TYPE_LABELS[roomType]} inspiration yet`"
      text="Import the researched ideas for this room type, or add your own by URL."
    >
      <template #actions>
        <v-btn
          v-if="seedCount > 0"
          color="primary"
          prepend-icon="mdi-import"
          @click="importSeeds"
        >Import {{ seedCount }} researched ideas</v-btn>
        <v-btn variant="text" prepend-icon="mdi-link-plus" @click="openAdd">Add by URL</v-btn>
      </template>
    </v-empty-state>

    <InspirationAddByUrlDialog v-model="dialogOpen" :default-room-type="roomType" :item="editing" />
  </div>
</template>
