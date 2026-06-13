<script setup lang="ts">
// Design-psychology research page, rendered from the Phase 1 corpus parsed at
// build time. Section ids are the stable slugs that psychologyTag popovers
// link to — the "no dead anchors" contract is tested in tests/templates.test.ts.
const { entries } = useResearch()
</script>

<template>
  <div class="research-page">
    <h1 class="text-h4 mb-1">Design research</h1>
    <p class="text-body-1 text-medium-emphasis mb-6">
      The why behind remodel choices — {{ entries.length }} principles, each
      sourced and fact-checked. Checklist items link here via their
      <v-icon icon="mdi-information-outline" size="small" /> popovers.
    </p>

    <v-card v-for="entry in entries" :id="entry.slug" :key="entry.slug" class="mb-6 research-section">
      <v-card-item>
        <v-card-title class="text-h6">{{ entry.title }}</v-card-title>
        <v-card-subtitle class="mt-1">
          <v-chip
            v-for="roomName in entry.rooms"
            :key="roomName"
            size="x-small"
            variant="tonal"
            class="mr-1"
          >
            {{ roomName }}
          </v-chip>
        </v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <p class="text-body-2 mb-4">{{ entry.summary }}</p>

        <div class="text-subtitle-2 mb-1">Apply it</div>
        <ul class="pl-5 text-body-2 mb-4">
          <li v-for="(application, i) in entry.applications" :key="i" class="mb-1">
            {{ application }}
          </li>
        </ul>

        <div class="text-subtitle-2 mb-1">Sources</div>
        <div v-for="source in entry.sources" :key="source.url" class="text-body-2 mb-1">
          <a :href="source.url" target="_blank" rel="noopener noreferrer">
            {{ source.title }}
            <v-icon icon="mdi-open-in-new" size="x-small" />
          </a>
          <span v-if="source.note" class="text-medium-emphasis"> — {{ source.note }}</span>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.research-page {
  max-width: 880px;
}
/* Anchored sections land below the app bar, not under it. */
.research-section {
  scroll-margin-top: 80px;
}
</style>
