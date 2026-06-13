<script setup lang="ts">
import type { Permit, PermitStatus } from '~/models'
import { PermitStatus as StatusEnum } from '~/models'
import { DEFAULT_AUTHORITY } from '~/config/permits'
import { formatMoney, parseMoney } from '~/utils/money'
import { usePermitOps, type NewPermitFields } from '~/composables/usePermits'

const props = defineProps<{ modelValue: boolean, permit?: Permit, defaultScope?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = usePermitOps()
const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.permit)

const scope = ref('')
const authority = ref(DEFAULT_AUTHORITY)
const permitNumber = ref('')
const status = ref<PermitStatus>('needed')
const feeInput = ref('')
const appliedAt = ref('')
const issuedAt = ref('')

watch(open, (v) => {
  if (!v) return
  const p = props.permit
  scope.value = p?.scope ?? props.defaultScope ?? ''
  authority.value = p?.authority ?? DEFAULT_AUTHORITY
  permitNumber.value = p?.permitNumber ?? ''
  status.value = p?.status ?? 'needed'
  feeInput.value = p?.feeCents != null ? formatMoney(p.feeCents) : ''
  appliedAt.value = p?.appliedAt ?? ''
  issuedAt.value = p?.issuedAt ?? ''
}, { immediate: true })

const statusItems = StatusEnum.options.map(v => ({ value: v, title: v }))
const feeCents = computed(() => (feeInput.value.trim() ? parseMoney(feeInput.value) : null))
const valid = computed(() => !!scope.value.trim() && (!feeInput.value.trim() || feeCents.value != null))

function save() {
  if (!valid.value) return
  const fields: NewPermitFields = {
    scope: scope.value.trim(),
    authority: authority.value.trim() || DEFAULT_AUTHORITY,
    status: status.value,
    inspections: props.permit?.inspections ?? [],
    ...(permitNumber.value.trim() ? { permitNumber: permitNumber.value.trim() } : {}),
    ...(feeCents.value != null ? { feeCents: feeCents.value } : {}),
    ...(appliedAt.value ? { appliedAt: appliedAt.value } : {}),
    ...(issuedAt.value ? { issuedAt: issuedAt.value } : {}),
  }
  if (props.permit) {
    ops.save({ id: props.permit.id, uid: props.permit.uid, projectId: props.permit.projectId, ...fields })
  }
  else {
    ops.add(fields)
  }
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit permit' : 'Add permit' }}</v-card-title>
      <v-card-text>
        <v-text-field v-model="scope" label="Scope" density="comfortable" autofocus class="mb-2" />
        <div class="d-flex ga-2">
          <v-text-field v-model="authority" label="Authority" density="comfortable" class="mb-2" />
          <v-select v-model="status" :items="statusItems" label="Status" density="comfortable" class="mb-2" />
        </div>
        <div class="d-flex ga-2">
          <v-text-field v-model="permitNumber" label="Permit number (optional)" density="comfortable" class="mb-2" />
          <v-text-field
            v-model="feeInput"
            label="Fee (optional)"
            prefix="$"
            density="comfortable"
            :error="!!feeInput.trim() && feeCents == null"
            hint="Flows to the budget under Permits"
            persistent-hint
            class="mb-2"
          />
        </div>
        <div class="d-flex ga-2">
          <v-text-field v-model="appliedAt" label="Applied" type="date" density="comfortable" />
          <v-text-field v-model="issuedAt" label="Issued" type="date" density="comfortable" />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
