<script setup lang="ts">
import { useProjectStore } from '~/stores/project'

// UX1: the project-level progress ring lives in the app bar, always visible.
// Fed by the same rollup source as every other progress number. The numeric
// percentage inside the ring keeps the channel non-color-dependent.
const projectStore = useProjectStore()
const rollup = useRollup()

const progress = computed(() => rollup.project.value)
</script>

<template>
  <v-tooltip v-if="projectStore.currentProjectId" location="bottom">
    <template #activator="{ props: tipProps }">
      <v-progress-circular
        v-bind="tipProps"
        :model-value="progress.pct"
        :color="progress.complete ? 'success' : 'primary'"
        size="34"
        width="3"
        class="mr-2"
        :aria-label="`Project progress ${progress.pct}%`"
      >
        <span class="text-caption font-weight-medium">{{ progress.pct }}</span>
      </v-progress-circular>
    </template>
    Project progress: {{ progress.pct }}% ({{ progress.done }} of {{ progress.total }} items done)
  </v-tooltip>
</template>
