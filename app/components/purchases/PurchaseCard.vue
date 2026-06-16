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

// Upload (or replace) a photo of the item from the camera / photo library.
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
function pickPhoto() {
  fileInput.value?.click()
}
async function onPhoto(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // reset so picking the same file again still fires change
  if (!file) return
  uploading.value = true
  try {
    await ops.uploadImage(props.item, file)
  }
  finally {
    uploading.value = false
  }
}

// Receipt upload (photo or PDF) — relevant once the item is purchased.
const receiptInput = ref<HTMLInputElement | null>(null)
const uploadingReceipt = ref(false)
function pickReceipt() {
  receiptInput.value?.click()
}
async function onReceipt(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadingReceipt.value = true
  try {
    await ops.uploadReceipt(props.item, file)
  }
  finally {
    uploadingReceipt.value = false
  }
}
</script>

<template>
  <v-card variant="outlined" class="h-100 d-flex flex-column">
    <!-- Item photo: shown only when set, with replace / remove controls. -->
    <div v-if="item.imageUrl" class="pur-photo">
      <v-img :src="item.imageUrl" :alt="item.title" :aspect-ratio="4 / 3" cover>
        <template #error>
          <div class="img-fallback"><v-icon icon="mdi-image-off-outline" /></div>
        </template>
      </v-img>
      <div class="pur-photo__actions">
        <v-btn
          icon="mdi-camera-outline"
          size="x-small"
          variant="flat"
          :loading="uploading"
          aria-label="Replace photo"
          @click="pickPhoto"
        />
        <v-btn
          icon="mdi-delete-outline"
          size="x-small"
          variant="flat"
          color="error"
          aria-label="Remove photo"
          @click="ops.removeImage(item)"
        />
      </div>
    </div>

    <div class="pa-3 d-flex flex-column flex-grow-1">
      <!-- No photo yet → a compact upload affordance (was a full-size empty box). -->
      <button
        v-if="!item.imageUrl"
        type="button"
        class="pur-photo__add mb-3"
        :disabled="uploading"
        @click="pickPhoto"
      >
        <v-progress-circular v-if="uploading" indeterminate size="18" width="2" />
        <template v-else>
          <v-icon icon="mdi-camera-plus-outline" size="small" />
          <span>Add photo</span>
        </template>
      </button>

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

      <!-- Receipt: prompt once purchased; show a view/remove row when attached. -->
      <div v-if="item.receiptUrl || item.status === 'purchased'" class="mt-2">
        <div v-if="item.receiptUrl" class="d-flex align-center ga-1">
          <a
            :href="item.receiptUrl"
            target="_blank"
            rel="noopener"
            class="text-caption text-primary text-decoration-none d-inline-flex align-center ga-1 min-width-0 text-truncate"
          >
            <v-icon :icon="item.receiptType === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-receipt-text-outline'" size="small" />
            View receipt
            <v-icon icon="mdi-open-in-new" size="x-small" />
          </a>
          <v-spacer />
          <v-btn icon="mdi-close" size="x-small" variant="text" aria-label="Remove receipt" @click="ops.removeReceipt(item)" />
        </div>
        <button v-else type="button" class="pur-receipt__add" :disabled="uploadingReceipt" @click="pickReceipt">
          <v-progress-circular v-if="uploadingReceipt" indeterminate size="16" width="2" />
          <template v-else>
            <v-icon icon="mdi-receipt-text-plus-outline" size="small" />
            <span>Add receipt (photo or PDF)</span>
          </template>
        </button>
      </div>

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
    <input ref="fileInput" type="file" accept="image/*" hidden @change="onPhoto">
    <input ref="receiptInput" type="file" accept="image/*,application/pdf" hidden @change="onReceipt">
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
.pur-photo {
  position: relative;
}
.pur-photo__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
}
.pur-photo__actions :deep(.v-btn) {
  background: rgba(255, 255, 255, 0.9);
}
/* Compact "Add photo" affordance — replaces the old full-size empty image box. */
.pur-photo__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  border: 1px dashed rgba(30, 58, 95, 0.28);
  border-radius: 8px;
  background: rgba(30, 58, 95, 0.03);
  color: rgb(var(--v-theme-primary));
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.pur-photo__add:hover {
  background: rgba(30, 58, 95, 0.07);
}
.pur-photo__add:disabled {
  cursor: default;
  opacity: 0.7;
}
/* Receipt prompt — slimmer/quieter than the photo one. */
.pur-receipt__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 36px;
  border: 1px dashed rgba(30, 58, 95, 0.22);
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-secondary));
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.pur-receipt__add:hover {
  background: rgba(30, 58, 95, 0.05);
}
.pur-receipt__add:disabled {
  cursor: default;
  opacity: 0.7;
}
.min-width-0 {
  min-width: 0;
}
</style>
