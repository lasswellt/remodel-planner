<script setup lang="ts">
// Info popover linking a template checklist item to its design-psychology
// research entry (Phase 5 spec). Renders nothing for an unknown tag — tests
// assert every shipped tag resolves, so that path never fires in practice.
const props = defineProps<{ tag: string }>()

const { bySlug } = useResearch()
const entry = computed(() => bySlug[props.tag])
</script>

<template>
  <v-menu v-if="entry" location="bottom" max-width="380" :close-on-content-click="false">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        icon="mdi-information-outline"
        size="x-small"
        variant="text"
        density="comfortable"
        :aria-label="`Why it matters: ${entry.title}`"
        @click.stop
      />
    </template>
    <v-card>
      <v-card-item>
        <v-card-title class="text-subtitle-1">{{ entry.title }}</v-card-title>
        <v-card-subtitle>Why it matters</v-card-subtitle>
      </v-card-item>
      <v-card-text class="text-body-2 popover-summary">
        {{ entry.summary }}
      </v-card-text>
      <v-card-actions>
        <v-btn
          variant="text"
          color="primary"
          size="small"
          append-icon="mdi-arrow-right"
          :to="`/research#${entry.slug}`"
        >
          Read the research
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<style scoped>
.popover-summary {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
  line-clamp: 6;
  overflow: hidden;
}
</style>
