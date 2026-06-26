<script setup lang="ts">
import type { Expense, Room } from '~/models'
import { BUDGET_CATEGORY_LABELS } from '~/utils/budget-math'
import { formatDateOnly } from '~/utils/date'
import { formatMoney } from '~/utils/money'
import { useLedgerOps, useProjectLedger } from '~/composables/useLedger'

const props = defineProps<{ room: Room }>()

const ledger = useProjectLedger()
const ops = useLedgerOps()

// Ledger order is chronological, newest first — what you spent most recently
// reads at the top (tie-break by label for a stable sort).
const expenses = computed(() =>
  [...ledger.forRoom(props.room.id)].sort(
    (a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label),
  ),
)
const totalCents = computed(() => ledger.roomTotalCents(props.room.id))

const dialogOpen = ref(false)
const editing = ref<Expense | undefined>(undefined)

function openAdd() {
  editing.value = undefined
  dialogOpen.value = true
}
function openEdit(expense: Expense) {
  editing.value = expense
  dialogOpen.value = true
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-2">
      <div>
        <div class="text-body-2 text-medium-emphasis">Spent</div>
        <div class="text-h6">{{ formatMoney(totalCents) }}</div>
      </div>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openAdd">Add expense</v-btn>
    </div>

    <!-- Tablet/desktop: full table. Phones (< sm): stacked cards (below) so the
         columns don't horizontal-scroll and actions stay reachable. -->
    <v-table v-if="expenses.length > 0" density="compact" class="ledger-table mb-2 d-none d-sm-block">
      <thead>
        <tr>
          <th>Date</th>
          <th>Item</th>
          <th>Category</th>
          <th class="text-right">Amount</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="expense in expenses" :key="expense.id">
          <td class="text-no-wrap">{{ formatDateOnly(expense.date) }}</td>
          <td>
            <a v-if="expense.link" :href="expense.link" target="_blank" rel="noopener" class="text-primary">
              {{ expense.label }}
            </a>
            <span v-else>{{ expense.label }}</span>
            <span v-if="expense.vendor" class="text-caption text-medium-emphasis"> · {{ expense.vendor }}</span>
            <div v-if="expense.note" class="text-caption text-medium-emphasis">{{ expense.note }}</div>
          </td>
          <td>
            <v-chip size="x-small" variant="tonal">{{ BUDGET_CATEGORY_LABELS[expense.category] }}</v-chip>
          </td>
          <td class="text-right text-no-wrap">{{ formatMoney(expense.amountCents) }}</td>
          <td class="text-right text-no-wrap">
            <v-btn
              icon="mdi-pencil-outline"
              size="x-small"
              variant="text"
              aria-label="Edit expense"
              @click="openEdit(expense)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              color="error"
              aria-label="Delete expense"
              @click="ops.remove(expense)"
            />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="font-weight-medium">
          <td colspan="3">Total spent</td>
          <td class="text-right">{{ formatMoney(totalCents) }}</td>
          <td />
        </tr>
      </tfoot>
    </v-table>

    <!-- Phone layout: one card per entry, all data + actions visible (no scroll). -->
    <div v-if="expenses.length > 0" class="d-sm-none mb-2">
      <div v-for="expense in expenses" :key="expense.id" class="exp-card pa-2 mb-2">
        <div class="d-flex align-center ga-2">
          <div class="flex-grow-1 exp-label">
            <a v-if="expense.link" :href="expense.link" target="_blank" rel="noopener" class="text-primary">{{ expense.label }}</a>
            <span v-else>{{ expense.label }}</span>
            <div class="text-caption text-medium-emphasis">
              {{ formatDateOnly(expense.date) }}<template v-if="expense.vendor"> · {{ expense.vendor }}</template>
            </div>
            <div v-if="expense.note" class="text-caption text-medium-emphasis">{{ expense.note }}</div>
          </div>
          <v-chip size="x-small" variant="tonal">{{ BUDGET_CATEGORY_LABELS[expense.category] }}</v-chip>
        </div>
        <div class="d-flex align-center ga-3 mt-1 text-body-2">
          <span class="font-weight-medium">{{ formatMoney(expense.amountCents) }}</span>
          <v-spacer />
          <v-btn icon="mdi-pencil-outline" size="small" variant="text" aria-label="Edit expense" @click="openEdit(expense)" />
          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" aria-label="Delete expense" @click="ops.remove(expense)" />
        </div>
      </div>
      <div class="d-flex justify-space-between px-2 text-body-2 font-weight-medium">
        <span>Total spent</span>
        <span>{{ formatMoney(totalCents) }}</span>
      </div>
    </div>

    <p v-if="expenses.length === 0" class="text-body-2 text-medium-emphasis">
      No expenses logged yet. Add one each time you spend on this room to build a running ledger.
    </p>

    <LedgerExpenseDialog v-model="dialogOpen" :room="room" :expense="editing" />
  </div>
</template>

<style scoped>
.ledger-table :deep(th) {
  font-weight: 600;
}
.exp-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}
.exp-label {
  min-width: 0;
  word-break: break-word;
}
</style>
