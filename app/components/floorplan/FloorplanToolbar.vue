<script setup lang="ts">
import type { FixtureKind, OpeningKind } from '~/models'
import type { DimDetail, FloorplanTool } from '~/composables/useFloorplan'
import { GRID_STEPS } from '~/utils/geometry'
import { FIXTURE_CATALOG, FIXTURE_OPTIONS } from '~/config/fixtures'

// Floorplan controls: tool toggle, multi-floor tabs, grid size, export. One
// primary action zone (UX5) — drawing; everything else stays compact. The
// opening (door/window) and fixture pickers appear contextually for their tool.
defineProps<{
  floors: number[]
  exportDisabled: boolean
  hasSelection: boolean
}>()

const emit = defineEmits<{
  addFloor: []
  export: [kind: 'svg' | 'png']
}>()

const tool = defineModel<FloorplanTool>('tool', { default: 'select' })
const gridStep = defineModel<number>('gridStep', { default: 6 })
const floor = defineModel<number>('floor', { default: 1 })
const openingKind = defineModel<OpeningKind>('openingKind', { default: 'door' })
const fixtureKind = defineModel<FixtureKind>('fixtureKind', { default: 'tub' })
const dimDetail = defineModel<DimDetail>('dimDetail', { default: 'medium' })

const gridItems = GRID_STEPS.map(step => ({
  title: `${step}″ grid`,
  value: step,
}))

const dimItems: { title: string, value: DimDetail }[] = [
  { title: 'Few dimensions', value: 'low' },
  { title: 'Room sizes', value: 'medium' },
  { title: 'All dimensions', value: 'all' },
]
</script>

<template>
  <div class="d-flex flex-wrap align-center ga-2 mb-3">
    <v-btn-toggle v-model="tool" mandatory density="comfortable" variant="outlined" divided>
      <v-btn value="select" prepend-icon="mdi-cursor-default-outline" size="small" aria-label="Select and move rooms">
        Select
      </v-btn>
      <v-btn value="draw" prepend-icon="mdi-shape-rectangle-plus" size="small" aria-label="Draw a new room">
        Draw room
      </v-btn>
      <v-btn
        value="notch"
        prepend-icon="mdi-scissors-cutting"
        size="small"
        :disabled="!hasSelection"
        aria-label="Cut a notch into the selected room"
      >
        Notch
      </v-btn>
      <v-btn value="opening" prepend-icon="mdi-door" size="small" aria-label="Place a door or window">
        Opening
      </v-btn>
      <v-btn value="fixture" prepend-icon="mdi-bathtub-outline" size="small" aria-label="Place a fixture">
        Fixture
      </v-btn>
    </v-btn-toggle>

    <!-- Contextual: door vs window when placing an opening -->
    <v-btn-toggle
      v-if="tool === 'opening'"
      v-model="openingKind"
      mandatory
      density="comfortable"
      variant="outlined"
      divided
    >
      <v-btn value="door" prepend-icon="mdi-door" size="small">Door</v-btn>
      <v-btn value="window" prepend-icon="mdi-window-closed-variant" size="small">Window</v-btn>
    </v-btn-toggle>

    <!-- Contextual: which fixture to drop -->
    <v-select
      v-if="tool === 'fixture'"
      v-model="fixtureKind"
      :items="FIXTURE_OPTIONS"
      :item-props="(item: typeof FIXTURE_OPTIONS[number]) => ({ prependIcon: item.icon })"
      density="compact"
      hide-details
      variant="outlined"
      class="fp-fixture-select"
      aria-label="Fixture to place"
    />
    <v-icon
      v-if="tool === 'fixture'"
      :icon="FIXTURE_CATALOG[fixtureKind].icon"
      class="text-medium-emphasis"
      aria-hidden="true"
    />

    <v-tabs v-model="floor" density="compact" class="fp-floor-tabs">
      <v-tab v-for="f in floors" :key="f" :value="f" size="small">
        Floor {{ f }}
      </v-tab>
    </v-tabs>
    <v-btn
      icon="mdi-plus"
      size="x-small"
      variant="tonal"
      aria-label="Add a floor"
      @click="emit('addFloor')"
    />

    <v-spacer />

    <v-select
      v-model="dimDetail"
      :items="dimItems"
      density="compact"
      hide-details
      variant="outlined"
      class="fp-dim-select"
      prepend-inner-icon="mdi-ruler-square"
      aria-label="How many dimensions to show on the plan"
    />

    <v-select
      v-model="gridStep"
      :items="gridItems"
      density="compact"
      hide-details
      variant="outlined"
      class="fp-grid-select"
      aria-label="Grid snap size"
    />

    <v-menu location="bottom end">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          prepend-icon="mdi-download-outline"
          variant="tonal"
          size="small"
          :disabled="exportDisabled"
        >
          Export
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-svg" title="Standalone SVG" @click="emit('export', 'svg')" />
        <v-list-item prepend-icon="mdi-file-png-box" title="PNG image" @click="emit('export', 'png')" />
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
.fp-grid-select {
  max-width: 120px;
}
.fp-dim-select {
  max-width: 170px;
}
.fp-fixture-select {
  max-width: 170px;
}
.fp-floor-tabs {
  max-width: 50%;
}
</style>
