<script setup lang="ts">
import type { PurchaseItem, PurchaseStatus } from '~/models'
import { PURCHASE_STATUS_COLORS, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_OPTIONS } from '~/config/purchases'
import { formatMoney } from '~/utils/money'
import { usePurchaseOps } from '~/composables/usePurchases'

const props = defineProps<{ item: PurchaseItem }>()
const emit = defineEmits<{ edit: [] }>()

const ops = usePurchaseOps()

function onRank(value: number | string | null) {
  const n = Number(value)
  ops.setRank(props.item, Number.isFinite(n) ? n : 0)
}
function onStatus(status: PurchaseStatus) {
  ops.setStatus(props.item, status)
}
</script>

<template>
  <v-card variant="outlined" class="h-100 d-flex flex-column">
    <v-img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" :aspect-ratio="4 / 3" cover>
      <template #error>
        <div class="img-fallback"><v-icon icon="mdi-image-off-outline" /></div>
      </template>
    </v-img>
    <div v-else class="img-fallback"><v-icon icon="mdi-cart-outline" size="32" /></div>

    <div class="pa-3 d-flex flex-column flex-grow-1">
      <div class="d-flex align-center ga-2">
        <a
          v-if="item.url"
          :href="item.url"
          target="_blank"
          rel="noopener"
          class="text-body-2 font-weight-medium text-primary text-decoration-none flex-grow-1 min-width-0 text-truncate"
        >
          {{ item.title }} <v-icon icon="mdi-open-in-new" size="x-small" />
        </a>
        <span v-else class="text-body-2 font-weight-medium flex-grow-1 min-width-0 text-truncate">{{ item.title }}</span>
        <v-menu>
          <template #activator="{ props: menu }">
            <v-chip :color="PURCHASE_STATUS_COLORS[item.status]" size="x-small" variant="flat" v-bind="menu">
              {{ PURCHASE_STATUS_LABELS[item.status] }}
            </v-chip>
          </template>
          <v-list density="compact">
            <v-list-subheader>Set status</v-list-subheader>
            <v-list-item
              v-for="st in PURCHASE_STATUS_OPTIONS"
              :key="st.value"
              :title="st.title"
              :disabled="st.value === item.status"
              @click="onStatus(st.value)"
            />
          </v-list>
        </v-menu>
      </div>
      <div v-if="item.vendor || item.priceCents != null" class="d-flex align-center ga-2 mt-1 text-caption text-medium-emphasis">
        <span v-if="item.vendor">{{ item.vendor }}</span>
        <span v-if="item.priceCents != null" class="font-weight-medium text-high-emphasis">{{ formatMoney(item.priceCents) }}</span>
      </div>
      <p v-if="item.notes" class="text-caption text-medium-emphasis mt-1 mb-0">{{ item.notes }}</p>
      <v-spacer />
      <div class="d-flex align-center mt-2">
        <v-rating
          :model-value="item.rank"
          length="5"
          size="x-small"
          density="compact"
          color="amber"
          active-color="amber"
          clearable
          @update:model-value="onRank"
        />
        <v-spacer />
        <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" aria-label="Edit" @click="emit('edit')" />
        <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" aria-label="Delete" @click="ops.remove(item)" />
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.img-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  background: rgba(127, 127, 127, 0.08);
  color: rgba(127, 127, 127, 0.6);
}
.min-width-0 {
  min-width: 0;
}
</style>
