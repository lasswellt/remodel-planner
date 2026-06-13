<script setup lang="ts">
import type { PurchaseItem, PurchaseStatus, Room } from '~/models'
import { PURCHASE_GROUP_SUGGESTIONS, PURCHASE_STATUS_OPTIONS } from '~/config/purchases'
import { formatMoney, parseMoney } from '~/utils/money'
import { fetchOpenGraph } from '~/utils/og-fetch'
import { usePurchaseOps, type NewPurchaseFields } from '~/composables/usePurchases'

const props = defineProps<{ modelValue: boolean, room: Room, item?: PurchaseItem, presetGroup?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = usePurchaseOps()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.item)

const title = ref('')
const group = ref('')
const status = ref<PurchaseStatus>('idea')
const rank = ref(0)
const vendor = ref('')
const url = ref('')
const imageUrl = ref('')
const priceInput = ref('')
const notes = ref('')
const fetching = ref(false)
const fetched = ref(false)

watch(open, (v) => {
  if (!v) return
  const i = props.item
  title.value = i?.title ?? ''
  group.value = i?.group ?? props.presetGroup ?? ''
  status.value = i?.status ?? 'idea'
  rank.value = i?.rank ?? 0
  vendor.value = i?.vendor ?? ''
  url.value = i?.url ?? ''
  imageUrl.value = i?.imageUrl ?? ''
  priceInput.value = i?.priceCents != null ? formatMoney(i.priceCents) : ''
  notes.value = i?.notes ?? ''
  fetched.value = false
}, { immediate: true })

const priceCents = computed(() => (priceInput.value.trim() ? parseMoney(priceInput.value) : null))
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
const imageValid = computed(() => {
  const v = imageUrl.value.trim()
  if (!v) return true
  try {
    return !!new URL(v)
  }
  catch {
    return false
  }
})
const valid = computed(() =>
  !!title.value.trim()
  && !!group.value.trim()
  && urlValid.value
  && imageValid.value
  && (!priceInput.value.trim() || priceCents.value != null),
)

async function lookup() {
  if (!urlValid.value || !url.value.trim()) return
  fetching.value = true
  try {
    const og = await fetchOpenGraph(url.value.trim())
    if (og.title && !title.value.trim()) title.value = og.title
    if (og.imageUrl && !imageUrl.value.trim()) imageUrl.value = og.imageUrl
    fetched.value = true
  }
  finally {
    fetching.value = false
  }
}

function save() {
  if (!valid.value) return
  const fields: NewPurchaseFields = {
    title: title.value.trim(),
    group: group.value.trim(),
    status: status.value,
    rank: rank.value || 0,
    ...(vendor.value.trim() ? { vendor: vendor.value.trim() } : {}),
    ...(url.value.trim() ? { url: url.value.trim() } : {}),
    ...(imageUrl.value.trim() ? { imageUrl: imageUrl.value.trim() } : {}),
    ...(priceCents.value != null ? { priceCents: priceCents.value } : {}),
    ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
  }
  if (props.item) {
    ops.save({
      id: props.item.id,
      uid: props.item.uid,
      projectId: props.item.projectId,
      roomId: props.item.roomId,
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
      <v-card-title>{{ isEdit ? 'Edit item' : 'Add item to buy' }}</v-card-title>
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
        <v-text-field v-model="title" label="Title" density="comfortable" class="mb-2" :error="!title.trim()" />
        <div class="d-flex ga-2">
          <v-combobox
            v-model="group"
            :items="PURCHASE_GROUP_SUGGESTIONS"
            label="Group"
            placeholder="e.g. Vanities"
            density="comfortable"
            class="mb-2"
            :error="!group.trim()"
          />
          <v-select v-model="status" :items="PURCHASE_STATUS_OPTIONS" label="Status" density="comfortable" class="mb-2" />
        </div>
        <div class="d-flex ga-2 mb-2">
          <v-text-field v-model="vendor" label="Vendor (optional)" density="comfortable" hide-details />
          <v-text-field
            v-model="priceInput"
            label="Price (optional)"
            prefix="$"
            density="comfortable"
            hide-details
            :error="!!priceInput.trim() && priceCents == null"
          />
        </div>
        <v-text-field v-model="imageUrl" label="Image URL (optional)" density="comfortable" class="mb-2" :error="!imageValid" />
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
