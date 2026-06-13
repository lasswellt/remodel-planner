<script setup lang="ts">
import { useProjectStore } from '~/stores/project'
import { useRoomsStore } from '~/stores/rooms'

// Rooms grid — secondary navigation into rooms (the floorplan is primary,
// UX4). Cards carry the same rollup ring as the plan (UX1).
const projectStore = useProjectStore()
const roomsStore = useRoomsStore()

const rooms = computed(() =>
  [...roomsStore.rooms].sort(
    (a, b) => a.floor - b.floor || a.name.localeCompare(b.name),
  ),
)
</script>

<template>
  <div>
    <!-- UX10: empty states teach — rooms are born on the floorplan. -->
    <v-empty-state
      v-if="!projectStore.currentProjectId || rooms.length === 0"
      icon="mdi-view-grid-plus-outline"
      title="No rooms yet"
      text="Rooms are drawn on the floorplan. Draw one, then come back here to apply its room-type template — checklists and tasks seeded as a head start."
      class="mt-8"
    >
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-floor-plan" to="/">
          Open the floorplan
        </v-btn>
      </template>
    </v-empty-state>

    <v-row v-else>
      <v-col v-for="room in rooms" :key="room.id" cols="12" sm="6" lg="4">
        <RoomsRoomCard :room="room" />
      </v-col>
    </v-row>
  </div>
</template>
