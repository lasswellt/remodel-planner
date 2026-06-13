<script setup lang="ts">
import type { PurchaseItem, Room } from '~/models'
import { PURCHASE_GROUP_SUGGESTIONS } from '~/config/purchases'
import { formatMoney } from '~/utils/money'
import { usePurchaseOps, useRoomPurchases } from '~/composables/usePurchases'

const props = defineProps<{ room: Room }>()

const { purchases } = useRoomPurchases(() => props.room.id)
const ops = usePurchaseOps()

// Group → items; each group sorted by rank desc then title, groups by name.
const grouped = computed(() => {
  const map = new Map<string, PurchaseItem[]>()
  for (const p of purchases.value) {
    const arr = map.get(p.group) ?? []
    arr.push(p)
    map.set(p.group, arr)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

// Total of everything not yet purchased that carries a price (the "still to buy"
// number a budget-minded user wants at a glance).
const toBuyTotal = computed(() =>
  purchases.value
    .filter(p => p.status !== 'purchased' && p.priceCents != null)
    .reduce((sum, p) => sum + (p.priceCents ?? 0), 0),
)

const dialogOpen = ref(false)
const editing = ref<PurchaseItem | undefined>(undefined)
const presetGroup = ref<string | undefined>(undefined)
function openAdd(group?: string) {
  editing.value = undefined
  presetGroup.value = group
  dialogOpen.value = true
}
function openEdit(p: PurchaseItem) {
  editing.value = p
  presetGroup.value = undefined
  dialogOpen.value = true
}
function quickAdd(group: string) {
  ops.add(props.room.id, { title: `New ${group.replace(/s$/, '')}`, group, status: 'idea', rank: 0 })
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-2">
      <span class="text-body-2 text-medium-emphasis">
        {{ purchases.length }} item{{ purchases.length === 1 ? '' : 's' }}
        <template v-if="toBuyTotal > 0"> · {{ formatMoney(toBuyTotal) }} to buy</template>
      </span>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openAdd()">Add item</v-btn>
    </div>

    <template v-if="purchases.length > 0">
      <div v-for="[group, groupItems] in grouped" :key="group" class="mb-5">
        <div class="d-flex align-center ga-2 mb-2">
          <h3 class="text-subtitle-2 font-weight-medium">{{ group }}</h3>
          <v-chip size="x-small" variant="tonal">{{ groupItems.length }}</v-chip>
          <v-spacer />
          <v-btn size="x-small" variant="text" prepend-icon="mdi-plus" class="text-none" @click="openAdd(group)">Add</v-btn>
        </div>
        <v-row dense>
          <v-col v-for="p in groupItems" :key="p.id" cols="12" sm="6" md="4">
            <PurchasesPurchaseCard :item="p" @edit="openEdit(p)" />
          </v-col>
        </v-row>
      </div>
    </template>

    <!-- Empty state suggests common groups; clicking one seeds a starter item. -->
    <div v-else class="text-body-2 text-medium-emphasis">
      <p class="mb-2">No items yet. Collect things to buy — group them and rank your favorites:</p>
      <div class="d-flex flex-wrap ga-1">
        <v-chip
          v-for="g in PURCHASE_GROUP_SUGGESTIONS.slice(0, 8)"
          :key="g"
          size="small"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="text-none"
          @click="quickAdd(g)"
        >{{ g }}</v-chip>
      </div>
    </div>

    <PurchasesPurchaseDialog v-model="dialogOpen" :room="room" :item="editing" :preset-group="presetGroup" />
  </div>
</template>
