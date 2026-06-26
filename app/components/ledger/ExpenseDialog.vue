<script setup lang="ts">
import type { BudgetCategory, Expense, Room } from '~/models'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS } from '~/utils/budget-math'
import { formatMoney, parseMoney } from '~/utils/money'
import { todayDateOnly } from '~/utils/selection-math'
import { useLedgerOps } from '~/composables/useLedger'

const props = defineProps<{ modelValue: boolean, room: Room, expense?: Expense }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = useLedgerOps()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.expense)

const label = ref('')
const category = ref<BudgetCategory>('materials')
const amountInput = ref('')
const date = ref('')
const vendor = ref('')
const note = ref('')
const link = ref('')

// (Re)seed the form whenever the dialog opens (UX: never show stale input). New
// entries default to today's date so the common case is one tap.
watch(open, (v) => {
  if (!v) return
  const e = props.expense
  label.value = e?.label ?? ''
  category.value = e?.category ?? 'materials'
  amountInput.value = e ? formatMoney(e.amountCents) : ''
  date.value = e?.date ?? todayDateOnly(new Date())
  vendor.value = e?.vendor ?? ''
  note.value = e?.note ?? ''
  link.value = e?.link ?? ''
}, { immediate: true })

const categoryItems = BUDGET_CATEGORIES.map(c => ({ value: c, title: BUDGET_CATEGORY_LABELS[c] }))

const amountCents = computed(() => parseMoney(amountInput.value))
const dateValid = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(date.value))
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
  && amountCents.value != null
  && dateValid.value
  && linkValid.value,
)

function save() {
  if (!valid.value || amountCents.value == null) return
  const fields = {
    label: label.value.trim(),
    category: category.value,
    amountCents: amountCents.value,
    date: date.value,
    ...(vendor.value.trim() ? { vendor: vendor.value.trim() } : {}),
    ...(note.value.trim() ? { note: note.value.trim() } : {}),
    ...(link.value.trim() ? { link: link.value.trim() } : {}),
  }
  if (props.expense) {
    ops.save({
      id: props.expense.id,
      uid: props.expense.uid,
      projectId: props.expense.projectId,
      roomId: props.expense.roomId,
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
      <v-card-title>{{ isEdit ? 'Edit expense' : 'Add expense' }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="label"
          label="What was it for?"
          density="comfortable"
          autofocus
          class="mb-2"
        />
        <div class="d-flex ga-2">
          <v-text-field
            v-model="amountInput"
            label="Amount"
            placeholder="e.g. $452.10"
            prefix="$"
            density="comfortable"
            :error="!!amountInput.trim() && amountCents == null"
            :hint="amountCents == null && amountInput.trim() ? 'Enter a dollar amount' : ' '"
            persistent-hint
            class="mb-2"
          />
          <v-text-field
            v-model="date"
            label="Date"
            type="date"
            density="comfortable"
            :error="!dateValid"
            class="mb-2"
          />
        </div>
        <v-select
          v-model="category"
          :items="categoryItems"
          label="Category"
          density="comfortable"
          class="mb-2"
        />
        <v-text-field
          v-model="vendor"
          label="Vendor (optional)"
          density="comfortable"
          class="mb-2"
        />
        <v-text-field
          v-model="note"
          label="Note (optional)"
          density="comfortable"
          class="mb-2"
        />
        <v-text-field
          v-model="link"
          label="Receipt link (optional)"
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
          {{ isEdit ? 'Save' : 'Add expense' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
