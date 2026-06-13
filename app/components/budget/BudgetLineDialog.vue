<script setup lang="ts">
import type { BudgetCategory, BudgetLine, Room } from '~/models'
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  typicalRange,
} from '~/utils/budget-math'
import { formatMoney, parseMoney } from '~/utils/money'
import { useBudgetOps } from '~/composables/useBudget'

const props = defineProps<{ modelValue: boolean, room: Room, line?: BudgetLine }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = useBudgetOps()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.line)

const label = ref('')
const category = ref<BudgetCategory>('materials')
const estimateInput = ref('')
const actualInput = ref('')
const vendor = ref('')
const link = ref('')

// (Re)seed the form whenever the dialog opens (UX: never show stale input).
watch(open, (v) => {
  if (!v) return
  const l = props.line
  label.value = l?.label ?? ''
  category.value = l?.category ?? 'materials'
  estimateInput.value = l ? formatMoney(l.estimateCents) : ''
  actualInput.value = l?.actualCents != null ? formatMoney(l.actualCents) : ''
  vendor.value = l?.vendor ?? ''
  link.value = l?.link ?? ''
}, { immediate: true })

const categoryItems = BUDGET_CATEGORIES.map(c => ({ value: c, title: BUDGET_CATEGORY_LABELS[c] }))

// UX12: anchor the estimate field with the room type's typical range.
const estimatePlaceholder = computed(() => {
  const r = typicalRange(props.room.type, category.value)
  return r ? `Typically ${formatMoney(r[0])}–${formatMoney(r[1])}` : 'e.g. $1,200'
})

const estimateCents = computed(() => parseMoney(estimateInput.value))
const actualCents = computed(() => (actualInput.value.trim() ? parseMoney(actualInput.value) : null))
const linkValid = computed(() => {
  const v = link.value.trim()
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
  && estimateCents.value != null
  && (!actualInput.value.trim() || actualCents.value != null)
  && linkValid.value,
)

function save() {
  if (!valid.value || estimateCents.value == null) return
  const fields = {
    label: label.value.trim(),
    category: category.value,
    estimateCents: estimateCents.value,
    ...(actualCents.value != null ? { actualCents: actualCents.value } : {}),
    ...(vendor.value.trim() ? { vendor: vendor.value.trim() } : {}),
    ...(link.value.trim() ? { link: link.value.trim() } : {}),
  }
  if (props.line) {
    ops.save({
      id: props.line.id,
      uid: props.line.uid,
      projectId: props.line.projectId,
      roomId: props.line.roomId,
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
  <v-dialog v-model="open" max-width="520">
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit budget line' : 'Add budget line' }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="label"
          label="Label"
          density="comfortable"
          autofocus
          class="mb-2"
        />
        <v-select
          v-model="category"
          :items="categoryItems"
          label="Category"
          density="comfortable"
          class="mb-2"
        />
        <v-text-field
          v-model="estimateInput"
          label="Estimate"
          :placeholder="estimatePlaceholder"
          persistent-placeholder
          prefix="$"
          density="comfortable"
          :error="!!estimateInput.trim() && estimateCents == null"
          :hint="estimateCents == null && estimateInput.trim() ? 'Enter a dollar amount' : ' '"
          persistent-hint
          class="mb-2"
        />
        <v-text-field
          v-model="actualInput"
          label="Actual (optional)"
          placeholder="Leave blank until spent"
          prefix="$"
          density="comfortable"
          :error="!!actualInput.trim() && actualCents == null"
          class="mb-2"
        />
        <v-text-field
          v-model="vendor"
          label="Vendor (optional)"
          density="comfortable"
          class="mb-2"
        />
        <v-text-field
          v-model="link"
          label="Link (optional)"
          placeholder="https://…"
          density="comfortable"
          :error="!linkValid"
          :hint="!linkValid ? 'Enter a valid URL' : ' '"
          persistent-hint
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">
          {{ isEdit ? 'Save' : 'Add line' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
