<script setup lang="ts">
import type { Room, Selection, SelectionStatus } from '~/models'
import { SelectionStatus as StatusEnum } from '~/models'
import { LONG_LEAD_SUGGESTIONS } from '~/utils/selection-math'
import { formatMoney } from '~/utils/money'
import { useProjectBudget } from '~/composables/useBudget'
import { useProjectSelections, useSelectionOps } from '~/composables/useSelections'

const props = defineProps<{ room: Room }>()

const sel = useProjectSelections()
const ops = useSelectionOps()
const budget = useProjectBudget()

const STATUS_RANK: Record<SelectionStatus, number> = {
  considering: 0,
  decided: 1,
  ordered: 2,
  delivered: 3,
  installed: 4,
}
const STATUS_COLOR: Record<SelectionStatus, string> = {
  considering: 'grey',
  decided: 'info',
  ordered: 'primary',
  delivered: 'teal',
  installed: 'success',
}

const items = computed(() =>
  [...sel.byRoom(props.room.id)].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.label.localeCompare(b.label),
  ),
)
const statusItems = StatusEnum.options.map(v => ({ value: v, title: v }))
const suggestions = computed(() => LONG_LEAD_SUGGESTIONS[props.room.type] ?? [])

const dialogOpen = ref(false)
const editing = ref<Selection | undefined>(undefined)
function openAdd() {
  editing.value = undefined
  dialogOpen.value = true
}
function openEdit(s: Selection) {
  editing.value = s
  dialogOpen.value = true
}
function quickAdd(label: string) {
  ops.add(props.room.id, { label, category: 'fixtures', status: 'considering' })
}

// Ordering a linked, priced selection offers to push its price into the budget.
const budgetOffer = ref<Selection | null>(null)
const offerLineLabel = computed(() => {
  const s = budgetOffer.value
  if (!s?.budgetLineId) return ''
  return budget.linesFor(props.room.id).find(l => l.id === s.budgetLineId)?.label ?? 'budget line'
})
function advanceTo(s: Selection, status: SelectionStatus) {
  ops.setStatus(s, status)
  if (status === 'ordered' && s.budgetLineId && s.priceCents != null) {
    budgetOffer.value = s
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
      <span class="text-body-2 text-medium-emphasis">{{ items.length }} selection{{ items.length === 1 ? '' : 's' }}</span>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openAdd">Add selection</v-btn>
    </div>

    <v-list v-if="items.length > 0" density="compact" class="py-0">
      <v-list-item
        v-for="s in items"
        :key="s.id"
        :class="{ 'overdue-row': sel.isSelectionOverdue(s) }"
        class="px-2"
      >
        <template #prepend>
          <v-icon
            v-if="sel.isSelectionOverdue(s)"
            icon="mdi-alert"
            color="warning"
            class="mr-2"
            aria-label="Overdue"
          />
        </template>
        <v-list-item-title class="d-flex align-center ga-2">
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="text-primary">{{ s.label }}</a>
          <span v-else>{{ s.label }}</span>
          <span class="text-caption text-medium-emphasis">{{ s.category }}</span>
        </v-list-item-title>
        <v-list-item-subtitle class="d-flex align-center ga-2 flex-wrap mt-1">
          <span v-if="s.vendor">{{ s.vendor }}</span>
          <span v-if="s.priceCents != null">{{ formatMoney(s.priceCents) }}</span>
          <span v-if="s.leadTimeDays != null">{{ s.leadTimeDays }}d lead</span>
          <span v-if="s.expectedAt" :class="sel.isSelectionOverdue(s) ? 'text-warning font-weight-medium' : ''">
            ETA {{ s.expectedAt }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-menu>
            <template #activator="{ props: menu }">
              <v-chip
                :color="STATUS_COLOR[s.status]"
                size="small"
                variant="flat"
                class="mr-1"
                v-bind="menu"
              >{{ s.status }}</v-chip>
            </template>
            <v-list density="compact">
              <v-list-subheader>Set status</v-list-subheader>
              <v-list-item
                v-for="st in statusItems"
                :key="st.value"
                :title="st.title"
                :disabled="st.value === s.status"
                @click="advanceTo(s, st.value)"
              />
            </v-list>
          </v-menu>
          <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" aria-label="Edit" @click="openEdit(s)" />
          <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" aria-label="Delete" @click="ops.remove(s)" />
        </template>
      </v-list-item>
    </v-list>

    <!-- UX10: empty state suggests common long-lead items for the room type. -->
    <div v-else class="text-body-2 text-medium-emphasis">
      <p class="mb-2">No selections yet. Long-lead items are the top schedule killer — start with:</p>
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

    <SelectionsSelectionDialog v-model="dialogOpen" :room="room" :selection="editing" />

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

<style scoped>
.overdue-row {
  background: rgba(var(--v-theme-warning), 0.08);
  border-radius: 6px;
}
</style>
