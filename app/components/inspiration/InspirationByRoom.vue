<script setup lang="ts">
import type { InspirationItem } from '~/models'
import { ROOM_TYPE_ICONS, ROOM_TYPE_LABELS } from '~/config/rooms'
import { useRoomsStore } from '~/stores/rooms'
import { useProjectInspiration } from '~/composables/useInspiration'

// "By room" inspiration view: per actual room, surfaces the shopping &
// selections list (items captured in the per-room view) alongside any
// inspiration pinned to that room — so the two work together in one place.
// ItemsSection reads the single shared project-wide items listener, so every
// room section below shares one listener.
const roomsStore = useRoomsStore()
const insp = useProjectInspiration()

const rooms = computed(() =>
  [...roomsStore.rooms].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name)),
)

const dialogOpen = ref(false)
const editing = ref<InspirationItem | undefined>(undefined)
function openEdit(i: InspirationItem) {
  editing.value = i
  dialogOpen.value = true
}
</script>

<template>
  <div>
    <v-empty-state
      v-if="rooms.length === 0"
      icon="mdi-floor-plan"
      title="No rooms yet"
      text="Draw rooms on the floorplan first — each room's shopping list and ideas show up here, grouped by room."
    >
      <template #actions>
        <v-btn color="primary" to="/" prepend-icon="mdi-floor-plan">Open the floorplan</v-btn>
      </template>
    </v-empty-state>

    <template v-else>
      <section v-for="room in rooms" :key="room.id" class="mb-8">
        <div class="d-flex align-center flex-wrap ga-2 mb-3">
          <v-icon :icon="ROOM_TYPE_ICONS[room.type]" />
          <h2 class="text-h6">{{ room.name }}</h2>
          <span class="text-body-2 text-medium-emphasis">{{ ROOM_TYPE_LABELS[room.type] }} · floor {{ room.floor }}</span>
          <v-chip v-if="insp.byRoom(room.id).length" size="x-small" variant="tonal" prepend-icon="mdi-image-outline">
            {{ insp.byRoom(room.id).length }}
          </v-chip>
          <v-spacer />
          <v-btn :to="`/rooms/${room.id}`" size="x-small" variant="text" append-icon="mdi-open-in-new" class="text-none">
            Open room
          </v-btn>
        </div>

        <!-- Inspiration pinned to this specific room -->
        <v-row v-if="insp.byRoom(room.id).length" class="mb-1">
          <v-col v-for="i in insp.byRoom(room.id)" :key="i.id" cols="12" sm="6" md="4" lg="3">
            <InspirationCard :item="i" @edit="openEdit(i)" />
          </v-col>
        </v-row>

        <!-- The room's shopping & selections list — reads the shared
             project-wide items listener, so this view opens one listener, not N. -->
        <ItemsSection :room="room" />

        <v-divider class="mt-6" />
      </section>

      <InspirationAddByUrlDialog v-model="dialogOpen" :item="editing" />
    </template>
  </div>
</template>
