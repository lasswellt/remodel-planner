<script setup lang="ts">
import { Timestamp } from 'firebase/firestore'
import type { Item, ItemStatus, Room } from '~/models'
import { CATEGORY_SUGGESTIONS, ITEM_STATUS_OPTIONS } from '~/config/items'
import { formatMoney, parseMoney } from '~/utils/money'
import { computeExpectedAt } from '~/utils/selection-math'
import { fetchOpenGraph } from '~/utils/og-fetch'
import { useProjectBudget } from '~/composables/useBudget'
import { useItemOps, type NewItemFields } from '~/composables/useItems'

const props = defineProps<{ modelValue: boolean, room: Room, item?: Item, presetCategory?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = useItemOps()
const budget = useProjectBudget()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.item)

const label = ref('')
const category = ref('')
const status = ref<ItemStatus>('idea')
const rank = ref(0)
const vendor = ref('')
const sku = ref('')
const url = ref('')
const imageUrl = ref('')
const priceInput = ref('')
const leadInput = ref('')
const budgetLineId = ref('')
const notes = ref('')
const fetching = ref(false)
const fetched = ref(false)

watch(open, (v) => {
  if (!v) return
  const i = props.item
  label.value = i?.label ?? ''
  category.value = i?.category ?? props.presetCategory ?? ''
  status.value = i?.status ?? 'idea'
  rank.value = i?.rank ?? 0
  vendor.value = i?.vendor ?? ''
  sku.value = i?.sku ?? ''
  url.value = i?.url ?? ''
  imageUrl.value = i?.imageUrl ?? ''
  priceInput.value = i?.priceCents != null ? formatMoney(i.priceCents) : ''
  leadInput.value = i?.leadTimeDays != null ? String(i.leadTimeDays) : ''
  budgetLineId.value = i?.budgetLineId ?? ''
  notes.value = i?.notes ?? ''
  fetched.value = false
}, { immediate: true })

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
const urlValid = computed(() => isValidUrl(url.value))
const imageValid = computed(() => isValidUrl(imageUrl.value))
function isValidUrl(v: string): boolean {
  const s = v.trim()
  if (!s) return true
  try {
    return !!new URL(s)
  }
  catch {
    return false
  }
}
const valid = computed(() =>
  !!label.value.trim()
  && urlValid.value
  && imageValid.value
  && (!priceInput.value.trim() || priceCents.value != null)
  && (!leadInput.value.trim() || leadTimeDays.value != null),
)

async function lookup() {
  if (!urlValid.value || !url.value.trim()) return
  fetching.value = true
  try {
    const og = await fetchOpenGraph(url.value.trim())
    if (og.title && !label.value.trim()) label.value = og.title
    if (og.imageUrl && !imageUrl.value.trim()) imageUrl.value = og.imageUrl
    fetched.value = true
  }
  finally {
    fetching.value = false
  }
}

function save() {
  if (!valid.value) return
  // Purchasing stamps the order date + derives the ETA (the schedule fact).
  let orderedAt = props.item?.orderedAt
  let expectedAt = props.item?.expectedAt
  if (status.value === 'purchased' && !orderedAt) {
    orderedAt = Timestamp.now()
    if (leadTimeDays.value != null) expectedAt = computeExpectedAt(orderedAt, leadTimeDays.value)
  }
  const fields: NewItemFields = {
    label: label.value.trim(),
    status: status.value,
    rank: rank.value || 0,
    ...(category.value.trim() ? { category: category.value.trim() } : {}),
    ...(vendor.value.trim() ? { vendor: vendor.value.trim() } : {}),
    ...(sku.value.trim() ? { sku: sku.value.trim() } : {}),
    ...(url.value.trim() ? { url: url.value.trim() } : {}),
    ...(imageUrl.value.trim() ? { imageUrl: imageUrl.value.trim() } : {}),
    ...(priceCents.value != null ? { priceCents: priceCents.value } : {}),
    ...(leadTimeDays.value != null ? { leadTimeDays: leadTimeDays.value } : {}),
    ...(budgetLineId.value ? { budgetLineId: budgetLineId.value } : {}),
    ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
    ...(orderedAt ? { orderedAt } : {}),
    ...(expectedAt ? { expectedAt } : {}),
  }
  if (props.item) {
    ops.save({
      id: props.item.id,
      uid: props.item.uid,
      projectId: props.item.projectId,
      roomId: props.item.roomId,
      // Preserve uploaded photo/receipt links the dialog doesn't edit.
      ...(props.item.imagePath ? { imagePath: props.item.imagePath } : {}),
      ...(props.item.receiptUrl ? { receiptUrl: props.item.receiptUrl } : {}),
      ...(props.item.receiptPath ? { receiptPath: props.item.receiptPath } : {}),
      ...(props.item.receiptType ? { receiptType: props.item.receiptType } : {}),
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
      <v-card-title>{{ isEdit ? 'Edit item' : 'Add item' }}</v-card-title>
      <v-card-text>
        <div class="d-flex ga-2 mb-2">
          <v-text-field
            v-model="url"
            label="Link (optional)"
            placeholder="https://…"
            density="comfortable"
            :error="!urlValid"
            hide-details
          />
          <v-btn :loading="fetching" :disabled="!url.trim() || !urlValid" variant="tonal" @click="lookup">Fetch</v-btn>
        </div>
        <p v-if="fetched" class="text-caption text-medium-emphasis mb-2">
          If the fields didn't fill, the site blocked the fetch — enter them manually.
        </p>
        <v-text-field v-model="label" label="Label" density="comfortable" class="mb-2" :error="!label.trim()" />
        <div class="d-flex ga-2">
          <v-combobox
            v-model="category"
            :items="CATEGORY_SUGGESTIONS"
            label="Category (optional)"
            placeholder="e.g. Vanities"
            density="comfortable"
            class="mb-2"
          />
          <v-select v-model="status" :items="ITEM_STATUS_OPTIONS" label="Status" density="comfortable" class="mb-2" />
        </div>
        <div class="d-flex ga-2 mb-2">
          <v-text-field v-model="vendor" label="Vendor (optional)" density="comfortable" hide-details />
          <v-text-field v-model="sku" label="SKU (optional)" density="comfortable" hide-details />
        </div>
        <div class="d-flex ga-2 mb-2">
          <v-text-field
            v-model="priceInput"
            label="Price (optional)"
            prefix="$"
            density="comfortable"
            hide-details
            :error="!!priceInput.trim() && priceCents == null"
          />
          <v-text-field
            v-model="leadInput"
            label="Lead time (days)"
            type="number"
            min="0"
            density="comfortable"
            hide-details
            :error="!!leadInput.trim() && leadTimeDays == null"
          />
        </div>
        <v-text-field v-model="imageUrl" label="Image URL (optional)" density="comfortable" class="mb-2" :error="!imageValid" />
        <v-select
          v-model="budgetLineId"
          :items="budgetLineItems"
          label="Linked budget line (optional)"
          density="comfortable"
          class="mb-2"
        />
        <div class="d-flex align-center ga-3">
          <span class="text-body-2 text-medium-emphasis">Rank</span>
          <v-rating v-model="rank" length="5" size="small" density="compact" color="amber" active-color="amber" clearable />
        </div>
        <v-text-field v-model="notes" label="Notes (optional)" density="comfortable" class="mt-2" hide-details />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
