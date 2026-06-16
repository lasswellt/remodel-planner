<script setup lang="ts">
import type { Item, ItemStatus, Room } from '~/models'
import { ITEM_STATUS_ORDER } from '~/models'
import { LONG_LEAD_SUGGESTIONS } from '~/utils/selection-math'
import { formatMoney } from '~/utils/money'
import { useProjectBudget } from '~/composables/useBudget'
import { useItemOps, useProjectItems } from '~/composables/useItems'

const props = defineProps<{ room: Room }>()

const api = useProjectItems()
const ops = useItemOps()
const budget = useProjectBudget()

const statusRank = (s: ItemStatus) => ITEM_STATUS_ORDER.indexOf(s)

// Group by category; within a group order by lifecycle stage, then favorites
// (rank desc), then label. Groups themselves sort alphabetically.
const grouped = computed(() => {
  const map = new Map<string, Item[]>()
  for (const i of api.byRoom(props.room.id)) {
    const key = i.category?.trim() || 'Other'
    const arr = map.get(key) ?? []
    arr.push(i)
    map.set(key, arr)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) =>
      statusRank(a.status) - statusRank(b.status)
      || (b.rank ?? 0) - (a.rank ?? 0)
      || a.label.localeCompare(b.label),
    )
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

const allItems = computed(() => api.byRoom(props.room.id))

// "Still to buy" = anything not yet purchased that carries a price.
const toBuyTotal = computed(() =>
  allItems.value
    .filter(i => (i.status === 'idea' || i.status === 'to-buy') && i.priceCents != null)
    .reduce((sum, i) => sum + (i.priceCents ?? 0), 0),
)

const suggestions = computed(() => LONG_LEAD_SUGGESTIONS[props.room.type] ?? [])

const dialogOpen = ref(false)
const editing = ref<Item | undefined>(undefined)
const presetCategory = ref<string | undefined>(undefined)
function openAdd(category?: string) {
  editing.value = undefined
  presetCategory.value = category
  dialogOpen.value = true
}
function openEdit(i: Item) {
  editing.value = i
  presetCategory.value = undefined
  dialogOpen.value = true
}
function quickAdd(label: string) {
  ops.add(props.room.id, { label, status: 'idea' })
}

// Purchasing a linked, priced item offers to push its price into the budget.
const budgetOffer = ref<Item | null>(null)
const offerLineLabel = computed(() => {
  const i = budgetOffer.value
  if (!i?.budgetLineId) return ''
  return budget.linesFor(props.room.id).find(l => l.id === i.budgetLineId)?.label ?? 'budget line'
})
function advanceTo(i: Item, status: ItemStatus) {
  ops.setStatus(i, status)
  if (status === 'purchased' && i.budgetLineId && i.priceCents != null) {
    budgetOffer.value = i
  }
}
function acceptBudgetOffer() {
  if (budgetOffer.value) ops.applyPriceToBudgetLine(budgetOffer.value)
  budgetOffer.value = null
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-2">
      <span class="text-body-2 text-medium-emphasis">
        {{ allItems.length }} item{{ allItems.length === 1 ? '' : 's' }}
        <template v-if="toBuyTotal > 0"> · {{ formatMoney(toBuyTotal) }} to buy</template>
      </span>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openAdd()">Add item</v-btn>
    </div>

    <template v-if="allItems.length > 0">
      <div v-for="[category, groupItems] in grouped" :key="category" class="mb-5">
        <div class="d-flex align-center ga-2 mb-2">
          <h3 class="text-subtitle-2 font-weight-medium">{{ category }}</h3>
          <v-chip size="x-small" variant="tonal">{{ groupItems.length }}</v-chip>
          <v-spacer />
          <v-btn size="x-small" variant="text" prepend-icon="mdi-plus" class="text-none" @click="openAdd(category === 'Other' ? undefined : category)">Add</v-btn>
        </div>
        <v-row dense>
          <v-col v-for="i in groupItems" :key="i.id" cols="12" sm="6" md="4">
            <ItemsItemCard :item="i" :overdue="api.isItemOverdue(i)" @edit="openEdit(i)" @advance="(s: ItemStatus) => advanceTo(i, s)" />
          </v-col>
        </v-row>
      </div>
    </template>

    <!-- Empty state suggests common long-lead items for the room type — the top
         schedule killer — so the user starts capturing them early. -->
    <div v-else class="text-body-2 text-medium-emphasis">
      <p class="mb-2">Nothing here yet. Capture what you'll buy and install — long-lead items are the top schedule killer, so start with:</p>
      <div class="d-flex flex-wrap ga-1">
        <v-chip
          v-for="sug in suggestions"
          :key="sug"
          size="small"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="text-none"
          @click="quickAdd(sug)"
        >{{ sug }}</v-chip>
      </div>
    </div>

    <ItemsItemDialog v-model="dialogOpen" :room="room" :item="editing" :preset-category="presetCategory" />

    <v-snackbar
      :model-value="!!budgetOffer"
      timeout="8000"
      color="surface-variant"
      @update:model-value="(v: boolean) => { if (!v) budgetOffer = null }"
    >
      Set {{ offerLineLabel }} actual to {{ budgetOffer?.priceCents != null ? formatMoney(budgetOffer.priceCents) : '' }}?
      <template #actions>
        <v-btn variant="text" @click="acceptBudgetOffer">Set actual</v-btn>
        <v-btn variant="text" @click="budgetOffer = null">Dismiss</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>
