<script setup lang="ts">
import type { RoomType } from '~/models'
import { ROOM_TYPE_OPTIONS } from '~/config/rooms'
import { useProjectStore } from '~/stores/project'

// Phase 11 inspiration gallery, image-first (UX11), seeded from the researched
// index (UX10) and extendable by URL. Psychology tags on each card cross-link
// into the research page. Two views: curated ideas by room TYPE, and a by-ROOM
// view that pulls in each room's shopping list alongside its pinned ideas.
const projectStore = useProjectStore()
const view = ref<'type' | 'room'>('type')
const roomType = ref<RoomType>('kitchen')
</script>

<template>
  <div>
    <v-empty-state
      v-if="!projectStore.currentProjectId"
      icon="mdi-image-multiple-outline"
      title="No project"
      text="Create or open a project to collect inspiration."
      class="mt-8"
    >
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-floor-plan" to="/">Open the floorplan</v-btn>
      </template>
    </v-empty-state>

    <template v-else>
      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <h1 class="text-h6">Inspiration</h1>
        <v-btn-toggle v-model="view" mandatory density="comfortable" variant="outlined" divided>
          <v-btn value="type" prepend-icon="mdi-shape-outline" size="small" class="text-none">By room type</v-btn>
          <v-btn value="room" prepend-icon="mdi-floor-plan" size="small" class="text-none">By room</v-btn>
        </v-btn-toggle>
        <v-select
          v-if="view === 'type'"
          v-model="roomType"
          :items="ROOM_TYPE_OPTIONS"
          label="Room type"
          density="compact"
          hide-details
          style="max-width: 240px"
        />
        <v-spacer />
        <span class="text-body-2 text-medium-emphasis">
          Tags link into the <NuxtLink to="/research" class="text-primary">research</NuxtLink>.
        </span>
      </div>

      <InspirationGallery v-if="view === 'type'" :room-type="roomType" />
      <InspirationByRoom v-else />
    </template>
  </div>
</template>
