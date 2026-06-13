<script setup lang="ts">
import { Timestamp } from 'firebase/firestore'
import type { Room, Selection, SelectionStatus } from '~/models'
import { SelectionStatus as StatusEnum } from '~/models'
import { formatMoney, parseMoney } from '~/utils/money'
import { computeExpectedAt } from '~/utils/selection-math'
import { useProjectBudget } from '~/composables/useBudget'
import { useSelectionOps, type NewSelectionFields } from '~/composables/useSelections'

const props = defineProps<{ modelValue: boolean, room: Room, selection?: Selection }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = useSelectionOps()
const budget = useProjectBudget()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.selection)

const label = ref('')
const category = ref('')
const vendor = ref('')
const sku = ref('')
const url = ref('')
const priceInput = ref('')
const leadInput = ref('')
const status = ref<SelectionStatus>('considering')
const budgetLineId = ref('')

watch(open, (v) => {
  if (!v) return
  const s = props.selection
  label.value = s?.label ?? ''
  category.value = s?.category ?? ''
  vendor.value = s?.vendor ?? ''
  sku.value = s?.sku ?? ''
  url.value = s?.url ?? ''
  priceInput.value = s?.priceCents != null ? formatMoney(s.priceCents) : ''
  leadInput.value = s?.leadTimeDays != null ? String(s.leadTimeDays) : ''
  status.value = s?.status ?? 'considering'
  budgetLineId.value = s?.budgetLineId ?? ''
}, { immediate: true })

const statusItems = StatusEnum.options.map(v => ({ value: v, title: v }))
const budgetLineItems = computed(() => [
  { value: '', title: 'No budget line' },
  ...budget.linesFor(props.room.id).map(l => ({ value: l.id, title: `${l.label} · ${formatMoney(l.estimateCents)}` })),
])

const priceCents = computed(() => (priceInput.value.trim() ? parseMoney(priceInput.value) : null))
const leadTimeDays = computed(() => {
  if (!leadInput.value.trim()) return null
  const n = Number(leadInput.value)
  return Number.isInteger(n) && n >= 0 ? n : null
})
const urlValid = computed(() => {
  const v = url.value.trim()
  if (!v) return true
  try {
    return !!new URL(v)
  }
  catch {
    return false
  }
})
const valid = computed(() =>
  !!label.value.trim()
  && !!category.value.trim()
  && (!priceInput.value.trim() || priceCents.value != null)
  && (!leadInput.value.trim() || leadTimeDays.value != null)
  && urlValid.value,
)

function save() {
  if (!valid.value) return
  let orderedAt = props.selection?.orderedAt
  let expectedAt = props.selection?.expectedAt
  if (status.value === 'ordered' && !orderedAt) {
    orderedAt = Timestamp.now()
    if (leadTimeDays.value != null) expectedAt = computeExpectedAt(orderedAt, leadTimeDays.value)
  }
  const fields: NewSelectionFields = {
    label: label.value.trim(),
    category: category.value.trim(),
    status: status.value,
    ...(vendor.value.trim() ? { vendor: vendor.value.trim() } : {}),
    ...(sku.value.trim() ? { sku: sku.value.trim() } : {}),
    ...(url.value.trim() ? { url: url.value.trim() } : {}),
    ...(priceCents.value != null ? { priceCents: priceCents.value } : {}),
    ...(leadTimeDays.value != null ? { leadTimeDays: leadTimeDays.value } : {}),
    ...(budgetLineId.value ? { budgetLineId: budgetLineId.value } : {}),
    ...(orderedAt ? { orderedAt } : {}),
    ...(expectedAt ? { expectedAt } : {}),
  }
  if (props.selection) {
    ops.save({
      id: props.selection.id,
      uid: props.selection.uid,
      projectId: props.selection.projectId,
      roomId: props.selection.roomId,
      ...fields,
    })
  }
  else {
    ops.add(props.room.id, fields)
  }
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit selection' : 'Add selection' }}</v-card-title>
      <v-card-text>
        <v-text-field v-model="label" label="Label" density="comfortable" autofocus class="mb-2" />
        <div class="d-flex ga-2">
          <v-text-field v-model="category" label="Category" density="comfortable" class="mb-2" />
          <v-select v-model="status" :items="statusItems" label="Status" density="comfortable" class="mb-2" />
        </div>
        <div class="d-flex ga-2">
          <v-text-field v-model="vendor" label="Vendor (optional)" density="comfortable" class="mb-2" />
          <v-text-field v-model="sku" label="SKU (optional)" density="comfortable" class="mb-2" />
        </div>
        <v-text-field
          v-model="url"
          label="URL (optional)"
          placeholder="https://…"
          density="comfortable"
          :error="!urlValid"
          class="mb-2"
        />
        <div class="d-flex ga-2">
          <v-text-field
            v-model="priceInput"
            label="Price (optional)"
            prefix="$"
            density="comfortable"
            :error="!!priceInput.trim() && priceCents == null"
            class="mb-2"
          />
          <v-text-field
            v-model="leadInput"
            label="Lead time (days)"
            type="number"
            min="0"
            density="comfortable"
            :error="!!leadInput.trim() && leadTimeDays == null"
            class="mb-2"
          />
        </div>
        <v-select
          v-model="budgetLineId"
          :items="budgetLineItems"
          label="Linked budget line (optional)"
          density="comfortable"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
