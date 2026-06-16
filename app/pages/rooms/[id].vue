<script setup lang="ts">
import { ROOM_TYPE_ICONS, ROOM_TYPE_LABELS } from '~/config/rooms'
import { CATEGORY_ORDER, ROOM_TEMPLATES } from '~/config/templates'
import { dimsLabel, sqFt } from '~/utils/geometry'
import { useRoomsStore } from '~/stores/rooms'
import { useProjectStore } from '~/stores/project'

// Room detail: the full checklist experience (Phase 5). Grouped by category
// with collapse state remembered (UX5); template application is framed as a
// head start (UX2); item deletion is undo-snackbar (UX8).
const route = useRoute()
const roomsStore = useRoomsStore()
const projectStore = useProjectStore()
const rollup = useRollup()
const { applyTemplate } = useTemplateApply()

const roomId = computed(() => String(route.params.id))
const room = computed(() => roomsStore.roomById[roomId.value] ?? null)

const checklist = useChecklist(() => room.value)
const progress = computed(() => rollup.byRoom(roomId.value))
const template = computed(() => (room.value ? ROOM_TEMPLATES[room.value.type] : null))
const typeLabel = computed(() => (room.value ? ROOM_TYPE_LABELS[room.value.type] : ''))

// --- template application (UX2: head start, never an empty burden) ---
const applying = ref(false)
const appliedMessage = ref('')

async function onApplyTemplate() {
  if (!room.value || applying.value) return
  applying.value = true
  try {
    const result = await applyTemplate(room.value)
    appliedMessage.value
      = `${typeLabel.value} planned — ${result.items} items, ${result.tasks} tasks seeded`
  }
  finally {
    applying.value = false
  }
}

// --- collapse state, remembered per room (UX5) ---
// Default = all categories open; once the user collapses something we persist
// their exact selection.
const storageKey = computed(() => `remodel.checklist.open.${roomId.value}`)
const openPanels = ref<string[]>([])
let userTouched = false

watch(
  [() => [...checklist.grouped.value.keys()], storageKey],
  ([categories]) => {
    const stored = localStorage.getItem(storageKey.value)
    if (stored) {
      userTouched = true
      openPanels.value = (JSON.parse(stored) as string[]).filter(c => categories.includes(c))
    }
    else if (!userTouched) {
      openPanels.value = categories
    }
  },
  { immediate: true },
)

function onPanelsChange(value: unknown) {
  userTouched = true
  openPanels.value = value as string[]
  localStorage.setItem(storageKey.value, JSON.stringify(openPanels.value))
}

// --- add item ---
const newLabel = ref('')
const newCategory = ref('Other')
const categoryOptions = computed(() => {
  const existing = [...checklist.grouped.value.keys()]
  return [...new Set([...existing, ...CATEGORY_ORDER, 'Other'])]
})

function addItem() {
  const label = newLabel.value.trim()
  if (!label || !room.value) return
  checklist.add(label, newCategory.value.trim() || 'Other')
  newLabel.value = ''
}
</script>

<template>
  <div>
    <v-empty-state
      v-if="!room"
      icon="mdi-help-circle-outline"
      title="Room not found"
      text="It may have been deleted, or belong to another project."
      class="mt-8"
    >
      <template #actions>
        <v-btn color="primary" to="/rooms">Back to rooms</v-btn>
      </template>
    </v-empty-state>

    <template v-else>
      <div class="d-flex align-center ga-2 mb-4">
        <v-btn icon="mdi-arrow-left" variant="text" to="/rooms" aria-label="Back to rooms" />
        <v-icon :icon="ROOM_TYPE_ICONS[room.type]" size="28" />
        <div class="min-width-0">
          <h1 class="text-h5">{{ room.name }}</h1>
          <div class="text-body-2 text-medium-emphasis">
            {{ typeLabel }} · {{ dimsLabel(room.geometry) }} ({{ sqFt(room.geometry) }} sq ft) · floor {{ room.floor }}
          </div>
        </div>
        <v-spacer />
        <div class="text-body-2 font-weight-medium">
          {{ progress.pct }}% ({{ progress.done }}/{{ progress.total }})
        </div>
      </div>
      <v-progress-linear
        :model-value="progress.pct"
        :color="progress.complete ? 'success' : 'primary'"
        height="8"
        rounded
        class="mb-6"
      />

      <!-- UX2/UX10: template as a head start, offered while unapplied -->
      <v-card v-if="!checklist.hasTemplate.value && template" variant="tonal" color="primary" class="mb-6">
        <v-card-item>
          <template #prepend>
            <v-icon icon="mdi-auto-fix" />
          </template>
          <v-card-title>Start with the {{ typeLabel }} template</v-card-title>
          <v-card-subtitle>
            {{ template.checklist.length }} checklist items and
            {{ template.tasks.length }} phase-ordered tasks, seeded as a head start.
            Add or remove anything afterwards.
          </v-card-subtitle>
          <template #append>
            <v-btn color="primary" :loading="applying" @click="onApplyTemplate">
              Apply template
            </v-btn>
          </template>
        </v-card-item>
      </v-card>

      <!-- Checklist grouped by category, collapse remembered (UX5) -->
      <v-expansion-panels
        v-if="checklist.items.value.length > 0"
        :model-value="openPanels"
        multiple
        variant="accordion"
        class="mb-6"
        @update:model-value="onPanelsChange"
      >
        <v-expansion-panel
          v-for="[category, items] in checklist.grouped.value"
          :key="category"
          :value="category"
        >
          <v-expansion-panel-title>
            {{ category }}
            <v-chip size="x-small" variant="tonal" class="ml-2">
              {{ items.filter(i => i.done).length }}/{{ items.length }}
            </v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-list density="compact" class="py-0">
              <RoomsChecklistItemRow
                v-for="item in items"
                :key="item.id"
                :item="item"
                removable
              />
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <!-- add item -->
      <v-card variant="outlined">
        <v-card-text>
          <v-form class="d-flex flex-wrap ga-2 align-center" @submit.prevent="addItem">
            <v-text-field
              v-model="newLabel"
              label="Add checklist item"
              density="compact"
              hide-details
              class="flex-grow-1 add-label"
            />
            <v-combobox
              v-model="newCategory"
              :items="categoryOptions"
              label="Category"
              density="compact"
              hide-details
              class="add-category"
            />
            <v-btn type="submit" color="primary" :disabled="!newLabel.trim()" prepend-icon="mdi-plus">
              Add
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>

      <!-- Shopping & selections: one list from idea → to-buy → purchased →
           delivered → installed. Grouped + star-ranked; long-lead items that
           gate this room's tasks track their order date + ETA here too. -->
      <section class="mt-8">
        <h2 class="text-h6 mb-2">Shopping &amp; selections</h2>
        <ItemsSection :room="room" />
      </section>

      <!-- Paint colors: brand, code, finish, surface + swatch per surface -->
      <section class="mt-8">
        <h2 class="text-h6 mb-2">Paint colors</h2>
        <PaintsSection :room="room" />
      </section>

      <!-- Photos (Phase 10): owner-only, since Storage is owner-scoped -->
      <section class="mt-8">
        <h2 class="text-h6 mb-2">Photos</h2>
        <PhotosPhotoGallery v-if="!projectStore.isSharedProject" :room="room" />
        <p v-else class="text-body-2 text-medium-emphasis">
          Photos are visible to the project owner only.
        </p>
      </section>

      <v-snackbar
        :model-value="!!appliedMessage"
        timeout="6000"
        color="success"
        @update:model-value="(v: boolean) => { if (!v) appliedMessage = '' }"
      >
        {{ appliedMessage }}
      </v-snackbar>
    </template>
  </div>
</template>

<style scoped>
.add-label {
  min-width: 220px;
}
.add-category {
  width: 200px;
  flex-grow: 0;
}
.min-width-0 {
  min-width: 0;
}
</style>
