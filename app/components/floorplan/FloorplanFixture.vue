<script setup lang="ts">
import type { Fixture, Geometry } from '~/models'
import { fixtureWorldRect } from '~/utils/geometry'
import { fixtureDetailPrims } from '~/utils/floorplan-draw'
import { fixtureLabel } from '~/config/fixtures'
import { FIXTURE_FILL, FIXTURE_LABEL, FIXTURE_SELECTED, FIXTURE_STROKE } from '~/utils/floorplan-style'

// One fixture/obstruction on the plan: a labeled box with kind-specific detail
// (tub basin, toilet bowl, …). Selection + drag are handled by useFloorplan via
// the data-fixture-id hook; this component is purely visual.
const props = defineProps<{
  roomGeometry: Geometry
  fixture: Fixture
  selected: boolean
}>()

const rect = computed(() => fixtureWorldRect(props.roomGeometry, props.fixture))
const detail = computed(() => fixtureDetailPrims(rect.value, props.fixture.kind))
const label = computed(() => fixtureLabel(props.fixture.kind, props.fixture.label))
const showLabel = computed(() => rect.value.w >= 28 && rect.value.h >= 16)
</script>

<template>
  <g
    :data-fixture-id="fixture.id"
    class="fp-fixture"
    role="img"
    :aria-label="`${label} fixture${fixture.rotation ? `, rotated ${fixture.rotation}°` : ''}`"
  >
    <title>{{ label }}{{ fixture.rotation ? `, rotated ${fixture.rotation}°` : '' }}</title>
    <rect
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
    <text
      v-if="showLabel"
      class="fp-fixture__label"
      :x="rect.x + rect.w / 2"
      :y="rect.y + rect.h / 2 + 3"
      text-anchor="middle"
      font-size="9"
      :fill="FIXTURE_LABEL"
    >{{ label }}</text>
  </g>
</template>

<style scoped>
.fp-fixture {
  cursor: move;
}
.fp-fixture__label {
  pointer-events: none;
  user-select: none;
  font-family: system-ui, sans-serif;
}
</style>
