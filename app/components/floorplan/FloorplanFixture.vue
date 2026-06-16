<script setup lang="ts">
import type { Fixture, Geometry } from '~/models'
import { dimsLabelWH, fixtureClearances, fixtureWorldRect } from '~/utils/geometry'
import { fixtureDetailPrims } from '~/utils/floorplan-draw'
import { fixtureLabel } from '~/config/fixtures'
import { FIXTURE_FILL, FIXTURE_LABEL, FIXTURE_SELECTED, FIXTURE_STROKE, LABEL_COLOR } from '~/utils/floorplan-style'

// One fixture/obstruction on the plan: a labeled box with kind-specific detail
// (tub basin, toilet bowl, …). Selection + drag are handled by useFloorplan via
// the data-fixture-id hook; this component is purely visual.
const props = defineProps<{
  roomGeometry: Geometry
  fixture: Fixture
  selected: boolean
  showSize?: boolean
}>()

const rect = computed(() => fixtureWorldRect(props.roomGeometry, props.fixture))
const detail = computed(() => fixtureDetailPrims(rect.value, props.fixture.kind))
const label = computed(() => fixtureLabel(props.fixture.kind, props.fixture.label))
const showLabel = computed(() => rect.value.w >= 28 && rect.value.h >= 16)
// Size label (e.g. 5' × 2'6") shown at 'all' detail when the box can fit a 2nd line.
const sizeLabel = computed(() => dimsLabelWH(rect.value.w, rect.value.h))
const showSizeLabel = computed(() => props.showSize && showLabel.value && rect.value.h >= 26)
// Clearances to the nearest walls (at 'all' detail) — placement reference.
const clearances = computed(() => (props.showSize ? fixtureClearances(props.roomGeometry, props.fixture) : []))
</script>

<template>
  <g
    :data-fixture-id="fixture.id"
    class="fp-fixture"
    :class="{ 'fp-fixture--selected': selected }"
    role="img"
    :aria-label="`${label} fixture${fixture.rotation ? `, rotated ${fixture.rotation}°` : ''}`"
  >
    <title>{{ label }}{{ fixture.rotation ? `, rotated ${fixture.rotation}°` : '' }}</title>
    <rect
      class="fp-fixture__box"
      :x="rect.x"
      :y="rect.y"
      :width="rect.w"
      :height="rect.h"
      rx="2"
      :fill="FIXTURE_FILL"
      :stroke="selected ? FIXTURE_SELECTED : FIXTURE_STROKE"
      :stroke-width="selected ? 2.5 : 1.25"
    />
    <FloorplanPrims :prims="detail" />
    <!-- Clearance to the nearest walls (at 'all' detail). -->
    <text
      v-for="(c, i) in clearances"
      :key="`fc${i}`"
      class="fp-fixture__measure"
      :x="c.x"
      :y="c.y"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="8"
      font-weight="600"
      :fill="LABEL_COLOR"
    >{{ c.text }}</text>
    <text
      v-if="showLabel"
      class="fp-fixture__label"
      :x="rect.x + rect.w / 2"
      :y="rect.y + rect.h / 2 + (showSizeLabel ? -2 : 3)"
      text-anchor="middle"
      font-size="9"
      :fill="FIXTURE_LABEL"
    >{{ label }}</text>
    <text
      v-if="showSizeLabel"
      class="fp-fixture__label"
      :x="rect.x + rect.w / 2"
      :y="rect.y + rect.h / 2 + 9"
      text-anchor="middle"
      font-size="8"
      :fill="FIXTURE_LABEL"
      opacity="0.75"
    >{{ sizeLabel }}</text>
  </g>
</template>

<style scoped>
.fp-fixture {
  cursor: move;
}
/* Hover affordance: an amber outline on the box so it's clearly grabbable
   (distinct from the blue selected state). */
.fp-fixture__box {
  transition: stroke 0.1s ease;
}
.fp-fixture:not(.fp-fixture--selected):hover .fp-fixture__box {
  stroke: #e8902b;
  stroke-width: 2;
}
.fp-fixture__label {
  pointer-events: none;
  user-select: none;
  font-family: system-ui, sans-serif;
}
.fp-fixture__measure {
  pointer-events: none;
  user-select: none;
  font-family: system-ui, sans-serif;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 2.5px;
  stroke-linejoin: round;
}
</style>
