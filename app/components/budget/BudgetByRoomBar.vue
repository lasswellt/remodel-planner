<script setup lang="ts">
import type { Room } from '~/models'
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_COLORS,
  BUDGET_CATEGORY_LABELS,
} from '~/utils/budget-math'
import { formatMoney } from '~/utils/money'
import { useProjectBudget } from '~/composables/useBudget'

const props = defineProps<{ rooms: Room[] }>()

const budget = useProjectBudget()

const rows = computed(() => {
  const est = budget.byRoomEstimates(props.rooms.map(r => r.id))
  const data = props.rooms.map((room) => {
    const byCat = est[room.id]!
    const total = BUDGET_CATEGORIES.reduce((s, c) => s + byCat[c], 0)
    return { room, byCat, total, over: budget.overBudgetRoomIds.value.has(room.id) }
  })
  return data
})
const maxTotal = computed(() => Math.max(1, ...rows.value.map(r => r.total)))
const hasAny = computed(() => rows.value.some(r => r.total > 0))
</script>

<template>
  <div>
    <div v-if="hasAny" class="bars">
      <div v-for="r in rows" :key="r.room.id" class="bar-row">
        <div class="bar-label text-body-2" :title="r.room.name">
          {{ r.room.name }}
          <v-icon
            v-if="r.over"
            icon="mdi-alert"
            color="warning"
            size="x-small"
            :aria-label="`${r.room.name} is over budget`"
          />
        </div>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: `${(r.total / maxTotal) * 100}%` }">
            <div
              v-for="c in BUDGET_CATEGORIES"
              v-show="r.byCat[c] > 0"
              :key="c"
              class="seg"
              :style="{ width: r.total > 0 ? `${(r.byCat[c] / r.total) * 100}%` : '0%', background: BUDGET_CATEGORY_COLORS[c] }"
              :title="`${BUDGET_CATEGORY_LABELS[c]}: ${formatMoney(r.byCat[c])}`"
            />
          </div>
        </div>
        <div class="bar-total text-body-2 text-medium-emphasis">{{ formatMoney(r.total) }}</div>
      </div>
    </div>
    <p v-else class="text-body-2 text-medium-emphasis ma-0">No budget lines yet.</p>
  </div>
</template>

<style scoped>
.bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bar-row {
  display: grid;
  grid-template-columns: minmax(80px, 140px) 1fr auto;
  align-items: center;
  gap: 10px;
}
.bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-track {
  background: rgba(127, 127, 127, 0.12);
  border-radius: 4px;
  height: 18px;
  overflow: hidden;
}
.bar-fill {
  display: flex;
  height: 100%;
  min-width: 2px;
  border-radius: 4px;
  overflow: hidden;
}
.seg {
  height: 100%;
}
.bar-total {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
