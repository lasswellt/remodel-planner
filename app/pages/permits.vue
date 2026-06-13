<script setup lang="ts">
import { COBB_PERMIT_SCOPES } from '~/config/permits'
import { TASK_PHASE_LABELS } from '~/config/tasks'
import { formatMoney } from '~/utils/money'
import { useProjectPermits } from '~/composables/usePermits'
import { useProjectStore } from '~/stores/project'

// Phase 9 permits. Project-level scopes + fees (which roll into the budget under
// Permits) and gating inspections. Failed inspections are the salient warning
// (UX6); the empty state offers Cobb County residential scopes (UX10).
const projectStore = useProjectStore()
const permitsApi = useProjectPermits()

const permits = computed(() =>
  [...permitsApi.permits.value].sort((a, b) => a.scope.localeCompare(b.scope)),
)
const hasProject = computed(() => !!projectStore.currentProjectId)

const addOpen = ref(false)
const addScope = ref<string | undefined>(undefined)
function openAdd(scope?: string) {
  addScope.value = scope
  addOpen.value = true
}
</script>

<template>
  <div>
    <v-empty-state
      v-if="!hasProject"
      icon="mdi-file-document-check-outline"
      title="No project"
      text="Create or open a project to track its permits and inspections."
      class="mt-8"
    >
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-floor-plan" to="/">Open the floorplan</v-btn>
      </template>
    </v-empty-state>

    <template v-else>
      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <div>
          <h1 class="text-h6">Permits</h1>
          <span class="text-body-2 text-medium-emphasis">
            Fees roll into the <NuxtLink to="/budget" class="text-primary">budget</NuxtLink> under Permits.
          </span>
        </div>
        <v-spacer />
        <span v-if="permitsApi.totalFeesCents.value > 0" class="text-body-2">
          Total fees: <strong>{{ formatMoney(permitsApi.totalFeesCents.value) }}</strong>
        </span>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openAdd()">Add permit</v-btn>
      </div>

      <!-- UX6: failed inspections are the salient warning across the project -->
      <v-alert
        v-if="permitsApi.failedInspections.value.length > 0"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-4"
        icon="mdi-alert-octagon"
      >
        {{ permitsApi.failedInspections.value.length }} failed inspection{{ permitsApi.failedInspections.value.length === 1 ? '' : 's' }}
        — schedule a re-inspection to unblock gated tasks:
        {{ permitsApi.failedInspections.value.map(f => `${f.inspection.label} (${TASK_PHASE_LABELS[f.inspection.gatePhase]})`).join(', ') }}
      </v-alert>

      <div v-if="permits.length > 0">
        <PermitsPermitCard v-for="p in permits" :key="p.id" :permit="p" />
      </div>
      <!-- UX10: empty state offers Cobb County residential scopes -->
      <div v-else class="text-body-2 text-medium-emphasis">
        <p class="mb-2">No permits yet. Common Cobb County residential scopes:</p>
        <div class="d-flex flex-wrap ga-1">
          <v-chip
            v-for="s in COBB_PERMIT_SCOPES"
            :key="s"
            size="small"
            variant="tonal"
            prepend-icon="mdi-plus"
            class="text-none"
            @click="openAdd(s)"
          >{{ s }}</v-chip>
        </div>
      </div>

      <PermitsPermitDialog v-model="addOpen" :default-scope="addScope" />
    </template>
  </div>
</template>
