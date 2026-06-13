<script setup lang="ts">
import type { Progress } from '~/utils/rollup'
import { TASK_PHASE_ORDER } from '~/models'
import { TASK_PHASE_LABELS } from '~/config/tasks'

// Per-phase progress bars fed by the one rollup source (UX1). Only phases that
// have tasks are shown.
const props = defineProps<{ byPhase: Record<string, Progress> }>()

const phases = computed(() =>
  TASK_PHASE_ORDER
    .map(phase => ({ phase, label: TASK_PHASE_LABELS[phase], progress: props.byPhase[phase]! }))
    .filter(p => p.progress.total > 0),
)
</script>

<template>
  <div v-if="phases.length > 0">
    <div v-for="p in phases" :key="p.phase" class="mb-2">
      <div class="d-flex justify-space-between text-body-2">
        <span>{{ p.label }}</span>
        <span class="text-medium-emphasis">{{ p.progress.done }}/{{ p.progress.total }}</span>
      </div>
      <v-progress-linear
        :model-value="p.progress.pct"
        :color="p.progress.complete ? 'success' : 'primary'"
        height="6"
        rounded
      />
    </div>
  </div>
  <p v-else class="text-body-2 text-medium-emphasis ma-0">
    No tasks yet — apply a room template to seed phase-ordered tasks.
  </p>
</template>
