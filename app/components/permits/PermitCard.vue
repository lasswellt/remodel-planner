<script setup lang="ts">
import type { Inspection, InspectionStatus, Permit } from '~/models'
import { InspectionStatus as IStatusEnum, PermitStatus as PStatusEnum } from '~/models'
import { TASK_PHASE_LABELS } from '~/config/tasks'
import {
  INSPECTION_STATUS_COLOR,
  INSPECTION_STATUS_LABELS,
  PERMIT_STATUS_COLOR,
  PERMIT_STATUS_LABELS,
} from '~/config/permits'
import { formatMoney } from '~/utils/money'
import { usePermitOps } from '~/composables/usePermits'

const props = defineProps<{ permit: Permit }>()
const ops = usePermitOps()

const permitStatusItems = PStatusEnum.options.map(v => ({ value: v, title: PERMIT_STATUS_LABELS[v] }))
const inspStatusItems = IStatusEnum.options.map(v => ({ value: v, title: INSPECTION_STATUS_LABELS[v] }))

const editPermitOpen = ref(false)
const inspDialogOpen = ref(false)
const editingInspection = ref<Inspection | undefined>(undefined)

function openAddInspection() {
  editingInspection.value = undefined
  inspDialogOpen.value = true
}
function openEditInspection(i: Inspection) {
  editingInspection.value = i
  inspDialogOpen.value = true
}
function setInspectionStatus(i: Inspection, status: InspectionStatus) {
  ops.upsertInspection(props.permit, { ...i, status })
}
// Re-inspection flow: a failed inspection spawns a fresh scheduled one with the
// same gate phase (the gate stays closed until this new one passes).
function scheduleReinspection(i: Inspection) {
  ops.upsertInspection(props.permit, {
    id: crypto.randomUUID(),
    label: i.label,
    gatePhase: i.gatePhase,
    status: 'scheduled',
  })
}
</script>

<template>
  <v-card variant="flat" border class="mb-3">
    <v-card-item>
      <v-card-title class="d-flex align-center ga-2">
        <span>{{ permit.scope }}</span>
        <v-menu>
          <template #activator="{ props: m }">
            <v-chip :color="PERMIT_STATUS_COLOR[permit.status]" size="small" variant="flat" v-bind="m">
              {{ PERMIT_STATUS_LABELS[permit.status] }}
            </v-chip>
          </template>
          <v-list density="compact">
            <v-list-subheader>Set status</v-list-subheader>
            <v-list-item
              v-for="s in permitStatusItems"
              :key="s.value"
              :title="s.title"
              :disabled="s.value === permit.status"
              @click="ops.setStatus(permit, s.value)"
            />
          </v-list>
        </v-menu>
      </v-card-title>
      <v-card-subtitle>
        {{ permit.authority }}
        <template v-if="permit.permitNumber"> · #{{ permit.permitNumber }}</template>
        <template v-if="permit.feeCents != null"> · {{ formatMoney(permit.feeCents) }} fee</template>
      </v-card-subtitle>
      <template #append>
        <v-btn icon="mdi-pencil-outline" size="small" variant="text" aria-label="Edit permit" @click="editPermitOpen = true" />
        <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" aria-label="Delete permit" @click="ops.remove(permit)" />
      </template>
    </v-card-item>

    <v-card-text class="pt-0">
      <div class="d-flex align-center justify-space-between mb-1">
        <span class="text-body-2 font-weight-medium">Inspections</span>
        <v-btn size="x-small" variant="tonal" prepend-icon="mdi-plus" @click="openAddInspection">Add</v-btn>
      </div>
      <v-list v-if="permit.inspections.length > 0" density="compact" class="py-0">
        <v-list-item
          v-for="i in permit.inspections"
          :key="i.id"
          :class="{ 'failed-row': i.status === 'failed' }"
          class="px-2"
        >
          <template #prepend>
            <v-icon v-if="i.status === 'failed'" icon="mdi-alert-octagon" color="error" class="mr-2" aria-label="Failed" />
          </template>
          <v-list-item-title>{{ i.label }}</v-list-item-title>
          <v-list-item-subtitle>
            gates {{ TASK_PHASE_LABELS[i.gatePhase] }}
            <template v-if="i.scheduledAt"> · {{ i.scheduledAt }}</template>
          </v-list-item-subtitle>
          <template #append>
            <v-btn
              v-if="i.status === 'failed'"
              size="x-small"
              variant="tonal"
              color="warning"
              class="text-none mr-1"
              prepend-icon="mdi-calendar-refresh"
              @click="scheduleReinspection(i)"
            >Re-inspect</v-btn>
            <v-menu>
              <template #activator="{ props: m }">
                <v-chip :color="INSPECTION_STATUS_COLOR[i.status]" size="small" variant="flat" class="mr-1" v-bind="m">
                  {{ INSPECTION_STATUS_LABELS[i.status] }}
                </v-chip>
              </template>
              <v-list density="compact">
                <v-list-subheader>Set status</v-list-subheader>
                <v-list-item
                  v-for="s in inspStatusItems"
                  :key="s.value"
                  :title="s.title"
                  :disabled="s.value === i.status"
                  @click="setInspectionStatus(i, s.value)"
                />
              </v-list>
            </v-menu>
            <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" aria-label="Edit inspection" @click="openEditInspection(i)" />
            <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" aria-label="Delete inspection" @click="ops.removeInspection(permit, i.id)" />
          </template>
        </v-list-item>
      </v-list>
      <p v-else class="text-body-2 text-medium-emphasis ma-0">
        No inspections. Add one with a gate phase to block later-phase tasks until it passes.
      </p>
    </v-card-text>

    <PermitsPermitDialog v-model="editPermitOpen" :permit="permit" />
    <PermitsInspectionDialog v-model="inspDialogOpen" :permit="permit" :inspection="editingInspection" />
  </v-card>
</template>

<style scoped>
.failed-row {
  background: rgba(var(--v-theme-error), 0.08);
  border-radius: 6px;
}
</style>
