<script setup lang="ts">
// Scaffold placeholder for routes whose features land in later build phases.
// Uses v-empty-state so the empty view already teaches what belongs here
// (UX10), rather than rendering a blank screen.
defineProps<{
  icon: string
  title: string
  text: string
  phase: string
}>()
</script>

<template>
  <v-empty-state :icon="icon" :title="title" :text="text" class="mt-8">
    <template #actions>
      <v-chip size="small" variant="tonal" color="secondary" :prepend-icon="'mdi-progress-wrench'">
        Coming in the {{ phase }} phase
      </v-chip>
    </template>
  </v-empty-state>
</template>
