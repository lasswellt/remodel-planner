<script setup lang="ts">
import { BUDGET_CATEGORY_LABELS } from '~/utils/budget-math'
import { downloadCsv, toCsv } from '~/utils/csv'
import { formatMoney, parseMoney } from '~/utils/money'
import { useProjectBudget } from '~/composables/useBudget'
import { useProjectStore } from '~/stores/project'
import { useRoomsStore } from '~/stores/rooms'

// Phase 6 budget dashboard. Leads with remaining (UX7); over-budget rooms are
// isolated to the top with warning treatment (UX6); contingency is framed as
// protection with a planning-fallacy note.
const projectStore = useProjectStore()
const roomsStore = useRoomsStore()
const budget = useProjectBudget()

const hasProject = computed(() => !!projectStore.currentProjectId)
const project = computed(() => budget.project.value)

// Over-budget rooms first (UX6), then by floor + name.
const rooms = computed(() =>
  [...roomsStore.rooms].sort((a, b) => {
    const ao = budget.overBudgetRoomIds.value.has(a.id) ? 0 : 1
    const bo = budget.overBudgetRoomIds.value.has(b.id) ? 0 : 1
    return ao - bo || a.floor - b.floor || a.name.localeCompare(b.name)
  }),
)
const roomName = (id: string) => roomsStore.roomById[id]?.name ?? '—'

// --- edit total budget + contingency (owner only) ---
const editOpen = ref(false)
const budgetInput = ref('')
const contingencyInput = ref('')
function openEdit() {
  budgetInput.value = formatMoney(project.value.totalBudgetCents)
  contingencyInput.value = String(projectStore.currentProject?.contingencyPct ?? 15)
  editOpen.value = true
}
const editValid = computed(() => {
  const cents = parseMoney(budgetInput.value)
  const pct = Number(contingencyInput.value)
  return cents != null && Number.isInteger(pct) && pct >= 0 && pct <= 100
})
async function saveEdit() {
  const cents = parseMoney(budgetInput.value)
  const pct = Number(contingencyInput.value)
  const id = projectStore.currentProjectId
  if (cents == null || !id || !editValid.value) return
  await projectStore.setBudget(id, cents, pct)
  editOpen.value = false
}

// --- CSV export ---
function dollars(cents: number): string {
  return (cents / 100).toFixed(2)
}
function exportCsv() {
  const rows = budget.lines.value.map(l => [
    roomName(l.roomId),
    l.label,
    BUDGET_CATEGORY_LABELS[l.category],
    dollars(l.estimateCents),
    l.actualCents != null ? dollars(l.actualCents) : '',
    l.actualCents != null ? dollars(l.actualCents - l.estimateCents) : '',
    l.vendor ?? '',
    l.link ?? '',
  ])
  const csv = toCsv(
    ['Room', 'Item', 'Category', 'Estimate', 'Actual', 'Variance', 'Vendor', 'Link'],
    rows,
  )
  const name = (projectStore.currentProject?.name ?? 'project').replace(/[^\w-]+/g, '-').toLowerCase()
  downloadCsv(`${name}-budget.csv`, csv)
}
</script>

<template>
  <div>
    <v-empty-state
      v-if="!hasProject || rooms.length === 0"
      icon="mdi-cash-multiple"
      title="No budget yet"
      text="Budget lines live on your rooms. Draw a room on the floorplan, then add lines here — each estimate field shows the room type's typical cost range."
      class="mt-8"
    >
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-floor-plan" to="/">Open the floorplan</v-btn>
      </template>
    </v-empty-state>

    <template v-else>
      <!-- Summary: remaining-first (UX7) -->
      <v-card variant="flat" border class="mb-4">
        <v-card-text>
          <div class="d-flex flex-wrap align-center ga-6">
            <div>
              <div class="text-body-2 text-medium-emphasis">Remaining budget</div>
              <div class="text-h4" :class="project.remainingCents < 0 ? 'text-error' : 'text-success'">
                {{ formatMoney(Math.abs(project.remainingCents)) }}
                <span class="text-body-1">{{ project.remainingCents < 0 ? 'over' : 'left' }}</span>
                <v-icon
                  v-if="project.overBudget"
                  icon="mdi-alert-circle-outline"
                  color="error"
                  size="small"
                  aria-label="Estimates exceed the total budget"
                />
              </div>
            </div>
            <v-divider vertical />
            <div>
              <div class="text-body-2 text-medium-emphasis">Total budget</div>
              <div class="text-h6 d-flex align-center ga-1">
                {{ formatMoney(project.totalBudgetCents) }}
                <v-btn
                  v-if="!projectStore.isSharedProject"
                  icon="mdi-pencil-outline"
                  size="x-small"
                  variant="text"
                  aria-label="Edit budget"
                  @click="openEdit"
                />
              </div>
            </div>
            <div>
              <div class="text-body-2 text-medium-emphasis">Committed (estimated)</div>
              <div class="text-h6">{{ formatMoney(project.committedCents) }}</div>
              <div v-if="project.permitFeesCents > 0" class="text-caption text-medium-emphasis">
                incl. {{ formatMoney(project.permitFeesCents) }} permits
              </div>
            </div>
            <div>
              <div class="text-body-2 text-medium-emphasis d-flex align-center ga-1">
                Contingency ({{ projectStore.currentProject?.contingencyPct ?? 15 }}%)
                <v-icon icon="mdi-information-outline" size="x-small">
                  <v-tooltip activator="parent" location="top" max-width="280">
                    Contingency is protection against the planning fallacy — remodels almost
                    always uncover work you didn't estimate. {{ projectStore.currentProject?.contingencyPct ?? 15 }}%
                    is typical; older homes warrant more.
                  </v-tooltip>
                </v-icon>
              </div>
              <div class="text-h6">{{ formatMoney(project.contingencyCents) }}</div>
            </div>
            <v-spacer />
            <v-btn
              prepend-icon="mdi-file-delimited-outline"
              variant="tonal"
              :disabled="budget.lines.value.length === 0"
              @click="exportCsv"
            >
              Export CSV
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <!-- Charts -->
      <v-row class="mb-2">
        <v-col cols="12" md="7">
          <v-card variant="flat" border class="h-100">
            <v-card-title class="text-body-1">By room</v-card-title>
            <v-card-text>
              <BudgetByRoomBar :rooms="rooms" />
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card variant="flat" border class="h-100">
            <v-card-title class="text-body-1">By category</v-card-title>
            <v-card-text>
              <BudgetCategoryDonut />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Per-room sections, over-budget first -->
      <v-expansion-panels variant="accordion" multiple>
        <v-expansion-panel v-for="room in rooms" :key="room.id">
          <v-expansion-panel-title>
            <div class="d-flex align-center ga-2 w-100">
              <span>{{ room.name }}</span>
              <v-chip
                v-if="budget.overBudgetRoomIds.value.has(room.id)"
                size="x-small"
                color="warning"
                variant="flat"
                prepend-icon="mdi-alert"
              >Over budget</v-chip>
              <v-spacer />
              <span class="text-body-2 text-medium-emphasis mr-2">
                {{ formatMoney(budget.byRoom(room.id).estimateCents) }}
              </span>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <BudgetRoomBudgetSection :room="room" />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <!-- Edit budget dialog -->
    <v-dialog v-model="editOpen" max-width="420">
      <v-card>
        <v-card-title>Edit budget</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="budgetInput"
            label="Total budget"
            prefix="$"
            density="comfortable"
            class="mb-2"
          />
          <v-text-field
            v-model="contingencyInput"
            label="Contingency %"
            type="number"
            min="0"
            max="100"
            density="comfortable"
            suffix="%"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editOpen = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!editValid" @click="saveEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
