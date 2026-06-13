<script setup lang="ts">
import type { BudgetLine, Room } from '~/models'
import { BUDGET_CATEGORY_LABELS } from '~/utils/budget-math'
import { categoryRank } from '~/config/templates'
import { formatMoney } from '~/utils/money'
import { useBudgetOps, useProjectBudget } from '~/composables/useBudget'

const props = defineProps<{ room: Room }>()

const budget = useProjectBudget()
const ops = useBudgetOps()

const lines = computed(() =>
  [...budget.linesFor(props.room.id)].sort(
    (a, b) =>
      categoryRank(BUDGET_CATEGORY_LABELS[a.category]) - categoryRank(BUDGET_CATEGORY_LABELS[b.category])
      || a.category.localeCompare(b.category)
      || a.label.localeCompare(b.label),
  ),
)
const summary = computed(() => budget.byRoom(props.room.id))

const dialogOpen = ref(false)
const editing = ref<BudgetLine | undefined>(undefined)

function openAdd() {
  editing.value = undefined
  dialogOpen.value = true
}
function openEdit(line: BudgetLine) {
  editing.value = line
  dialogOpen.value = true
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-2">
      <div>
        <div class="text-body-2 text-medium-emphasis">Estimated</div>
        <div class="text-h6 d-flex align-center ga-2">
          {{ formatMoney(summary.estimateCents) }}
          <v-chip
            v-if="summary.overBudget"
            size="x-small"
            color="warning"
            variant="flat"
            prepend-icon="mdi-alert"
          >
            Over by {{ formatMoney(summary.varianceCents) }}
          </v-chip>
        </div>
      </div>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openAdd">Add line</v-btn>
    </div>

    <!-- Tablet/desktop: full table. Phones (< sm): stacked cards (below) so the
         6 columns don't horizontal-scroll and the actions stay reachable. -->
    <v-table v-if="lines.length > 0" density="compact" class="budget-table mb-2 d-none d-sm-block">
      <thead>
        <tr>
          <th>Item</th>
          <th>Category</th>
          <th class="text-right">Estimate</th>
          <th class="text-right">Actual</th>
          <th class="text-right">Variance</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.id">
          <td>
            <a v-if="line.link" :href="line.link" target="_blank" rel="noopener" class="text-primary">
              {{ line.label }}
            </a>
            <span v-else>{{ line.label }}</span>
            <span v-if="line.vendor" class="text-caption text-medium-emphasis"> · {{ line.vendor }}</span>
          </td>
          <td>
            <v-chip size="x-small" variant="tonal">{{ BUDGET_CATEGORY_LABELS[line.category] }}</v-chip>
          </td>
          <td class="text-right">{{ formatMoney(line.estimateCents) }}</td>
          <td class="text-right">{{ line.actualCents != null ? formatMoney(line.actualCents) : '—' }}</td>
          <td class="text-right">
            <span
              v-if="line.actualCents != null"
              :class="line.actualCents > line.estimateCents ? 'text-error' : 'text-success'"
            >
              {{ line.actualCents > line.estimateCents ? '+' : '' }}{{ formatMoney(line.actualCents - line.estimateCents) }}
            </span>
            <span v-else>—</span>
          </td>
          <td class="text-right text-no-wrap">
            <v-btn
              icon="mdi-pencil-outline"
              size="x-small"
              variant="text"
              aria-label="Edit line"
              @click="openEdit(line)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              color="error"
              aria-label="Delete line"
              @click="ops.remove(line)"
            />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="font-weight-medium">
          <td colspan="2">Subtotal</td>
          <td class="text-right">{{ formatMoney(summary.estimateCents) }}</td>
          <td class="text-right">{{ formatMoney(summary.actualCents) }}</td>
          <td class="text-right" :class="summary.varianceCents > 0 ? 'text-error' : 'text-success'">
            {{ summary.varianceCents > 0 ? '+' : '' }}{{ formatMoney(summary.varianceCents) }}
          </td>
          <td />
        </tr>
      </tfoot>
    </v-table>

    <!-- Phone layout: one card per line, all data + actions visible (no scroll). -->
    <div v-if="lines.length > 0" class="d-sm-none mb-2">
      <div v-for="line in lines" :key="line.id" class="bl-card pa-2 mb-2">
        <div class="d-flex align-center ga-2">
          <div class="flex-grow-1 bl-label">
            <a v-if="line.link" :href="line.link" target="_blank" rel="noopener" class="text-primary">{{ line.label }}</a>
            <span v-else>{{ line.label }}</span>
            <div v-if="line.vendor" class="text-caption text-medium-emphasis">{{ line.vendor }}</div>
          </div>
          <v-chip size="x-small" variant="tonal">{{ BUDGET_CATEGORY_LABELS[line.category] }}</v-chip>
        </div>
        <div class="d-flex align-center ga-3 mt-1 text-body-2">
          <span>Est {{ formatMoney(line.estimateCents) }}</span>
          <span v-if="line.actualCents != null">Act {{ formatMoney(line.actualCents) }}</span>
          <span
            v-if="line.actualCents != null"
            :class="line.actualCents > line.estimateCents ? 'text-error' : 'text-success'"
          >{{ line.actualCents > line.estimateCents ? '+' : '' }}{{ formatMoney(line.actualCents - line.estimateCents) }}</span>
          <v-spacer />
          <v-btn icon="mdi-pencil-outline" size="small" variant="text" aria-label="Edit line" @click="openEdit(line)" />
          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" aria-label="Delete line" @click="ops.remove(line)" />
        </div>
      </div>
      <div class="d-flex justify-space-between px-2 text-body-2 font-weight-medium">
        <span>Subtotal</span>
        <span>
          {{ formatMoney(summary.estimateCents) }}
          <span v-if="summary.varianceCents !== 0" :class="summary.varianceCents > 0 ? 'text-error' : 'text-success'">
            ({{ summary.varianceCents > 0 ? '+' : '' }}{{ formatMoney(summary.varianceCents) }})
          </span>
        </span>
      </div>
    </div>

    <p v-if="lines.length === 0" class="text-body-2 text-medium-emphasis">
      No budget lines yet. Add one — the estimate field shows this room type's typical range.
    </p>

    <BudgetLineDialog v-model="dialogOpen" :room="room" :line="editing" />
  </div>
</template>

<style scoped>
.budget-table :deep(th) {
  font-weight: 600;
}
.bl-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}
.bl-label {
  min-width: 0;
  word-break: break-word;
}
</style>
