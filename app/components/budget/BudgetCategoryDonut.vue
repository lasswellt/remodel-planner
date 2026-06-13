<script setup lang="ts">
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_COLORS,
  BUDGET_CATEGORY_LABELS,
} from '~/utils/budget-math'
import { formatMoney } from '~/utils/money'
import { useProjectBudget } from '~/composables/useBudget'

// Hand-rolled SVG donut (no chart dependency). Segments are stroked arcs via
// stroke-dasharray; rotation puts 0% at 12 o'clock.
const R = 60
const STROKE = 24
const C = 2 * Math.PI * R

const budget = useProjectBudget()

const data = computed(() => {
  const b = budget.breakdown.value
  const cats = BUDGET_CATEGORIES.map(c => ({
    category: c,
    label: BUDGET_CATEGORY_LABELS[c],
    color: BUDGET_CATEGORY_COLORS[c],
    estimateCents: b[c].estimateCents,
  })).filter(c => c.estimateCents > 0)
  const total = cats.reduce((s, c) => s + c.estimateCents, 0)
  let cumulative = 0
  const segments = cats.map((c) => {
    const frac = total > 0 ? c.estimateCents / total : 0
    const seg = {
      ...c,
      frac,
      dash: `${frac * C} ${C - frac * C}`,
      offset: -cumulative * C,
      pct: Math.round(frac * 100),
    }
    cumulative += frac
    return seg
  })
  return { segments, total }
})
</script>

<template>
  <div class="donut-wrap">
    <svg :viewBox="`0 0 ${(R + STROKE) * 2} ${(R + STROKE) * 2}`" class="donut" role="img" aria-label="Budget by category">
      <g :transform="`translate(${R + STROKE} ${R + STROKE}) rotate(-90)`">
        <circle
          v-for="s in data.segments"
          :key="s.category"
          :r="R"
          fill="none"
          :stroke="s.color"
          :stroke-width="STROKE"
          :stroke-dasharray="s.dash"
          :stroke-dashoffset="s.offset"
        />
      </g>
      <text :x="R + STROKE" :y="R + STROKE - 4" text-anchor="middle" class="donut-total">
        {{ formatMoney(data.total) }}
      </text>
      <text :x="R + STROKE" :y="R + STROKE + 16" text-anchor="middle" class="donut-sub">estimated</text>
    </svg>

    <ul class="legend">
      <li v-for="s in data.segments" :key="s.category" class="legend-item">
        <span class="swatch" :style="{ background: s.color }" />
        <span class="text-body-2">{{ s.label }}</span>
        <span class="text-body-2 text-medium-emphasis ml-auto">
          {{ formatMoney(s.estimateCents) }} · {{ s.pct }}%
        </span>
      </li>
      <li v-if="data.segments.length === 0" class="text-body-2 text-medium-emphasis">
        No budget lines yet.
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.donut {
  width: 168px;
  height: 168px;
  flex: 0 0 auto;
}
.donut-total {
  font-size: 18px;
  font-weight: 600;
  fill: currentColor;
}
.donut-sub {
  font-size: 11px;
  fill: currentColor;
  opacity: 0.6;
}
.legend {
  list-style: none;
  padding: 0;
  margin: 0;
  min-width: 200px;
  flex: 1 1 200px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex: 0 0 auto;
}
</style>
