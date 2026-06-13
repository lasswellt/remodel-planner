<script setup lang="ts">
import type { Inspection, InspectionStatus, Permit, TaskPhase } from '~/models'
import { InspectionStatus as StatusEnum } from '~/models'
import { TASK_PHASE_OPTIONS } from '~/config/tasks'
import { usePermitOps } from '~/composables/usePermits'

const props = defineProps<{ modelValue: boolean, permit: Permit, inspection?: Inspection }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = usePermitOps()
const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.inspection)

const label = ref('')
const gatePhase = ref<TaskPhase>('rough-in')
const status = ref<InspectionStatus>('pending')
const scheduledAt = ref('')
const resultNotes = ref('')

watch(open, (v) => {
  if (!v) return
  const i = props.inspection
  label.value = i?.label ?? ''
  gatePhase.value = i?.gatePhase ?? 'rough-in'
  status.value = i?.status ?? 'pending'
  scheduledAt.value = i?.scheduledAt ?? ''
  resultNotes.value = i?.resultNotes ?? ''
}, { immediate: true })

const statusItems = StatusEnum.options.map(v => ({ value: v, title: v }))
const valid = computed(() => !!label.value.trim())

function save() {
  if (!valid.value) return
  const inspection: Inspection = {
    id: props.inspection?.id ?? crypto.randomUUID(),
    label: label.value.trim(),
    gatePhase: gatePhase.value,
    status: status.value,
    ...(scheduledAt.value ? { scheduledAt: scheduledAt.value } : {}),
    ...(resultNotes.value.trim() ? { resultNotes: resultNotes.value.trim() } : {}),
  }
  ops.upsertInspection(props.permit, inspection)
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit inspection' : 'Add inspection' }}</v-card-title>
      <v-card-text>
        <v-text-field v-model="label" label="Inspection" density="comfortable" autofocus class="mb-2" />
        <div class="d-flex ga-2">
          <v-select
            v-model="gatePhase"
            :items="TASK_PHASE_OPTIONS"
            label="Gates phase"
            density="comfortable"
            hint="Blocks later-phase tasks until passed"
            persistent-hint
            class="mb-2"
          />
          <v-select v-model="status" :items="statusItems" label="Status" density="comfortable" class="mb-2" />
        </div>
        <v-text-field v-model="scheduledAt" label="Scheduled (optional)" type="date" density="comfortable" class="mb-2" />
        <v-textarea v-model="resultNotes" label="Result notes (optional)" rows="2" density="comfortable" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
