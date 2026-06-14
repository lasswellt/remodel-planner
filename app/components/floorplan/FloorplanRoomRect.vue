<script setup lang="ts">
import type { Geometry, Room } from '~/models'
import type { DimDetail } from '~/composables/useFloorplan'
import { buildRoomPath, dimsLabel, openingHitRect, openingMeasures, sqFt } from '~/utils/geometry'
import { openingPrims, wallPrims } from '~/utils/floorplan-draw'
import { FIXTURE_SELECTED, LABEL_COLOR, RING_ARC, RING_DONE, RING_TRACK, STATUS_STYLES } from '~/utils/floorplan-style'
import type { Progress } from '~/utils/rollup'
import { effectiveRoomStatus } from '~/utils/rollup'

// One room on the plan. Visual status encoding is never color-only (Build
// Conventions): planned = dashed outline, in-progress = solid, done = solid +
// "✓" in the label. The progress ring is always visible (UX1) when the rect
// is big enough to host it; hitting 100% plays a brief one-time celebration
// transition (UX3). Walls render as a structural band, openings (doors/windows)
// cut and annotate it, and fixtures sit on the floor.
const props = defineProps<{
  room: Room
  geometry: Geometry
  progress: Progress
  selected: boolean
  overBudget?: boolean
  selectedFixtureId?: string | null
  selectedOpeningId?: string | null
  dimDetail?: DimDetail
}>()

// Dimension annotations (room size, opening positions, fixture sizes) are hidden
// at 'low'; 'all' also dimensions every opening + fixture.
const showDims = computed(() => (props.dimDetail ?? 'medium') !== 'low')

const roomPath = computed(() => buildRoomPath(props.geometry))
// A room fully bitten away by higher rooms has no outline — suppress its walls,
// openings, fixtures and labels so they don't float on top of the covering room.
const covered = computed(() => roomPath.value === '')
const walls = computed(() => (covered.value ? [] : wallPrims(props.geometry)))
const fixtures = computed(() => (covered.value ? [] : props.geometry.fixtures ?? []))
// Openings rendered per-opening so each is selectable + draggable; each carries
// its symbol prims and a transparent hit rect for the pointer.
const openings = computed(() =>
  (covered.value ? [] : props.geometry.openings ?? []).map(op => ({
    op,
    prims: openingPrims(props.geometry, op),
    hit: openingHitRect(props.geometry, op),
  })),
)
// Dimension labels (gap to each corner) — for every opening at 'all' detail,
// otherwise just the selected one (shown live while dragging for placement).
const openingMeasureLabels = computed(() => {
  const ops = props.geometry.openings ?? []
  if (props.dimDetail === 'all') return ops.flatMap(o => openingMeasures(props.geometry, o))
  const sel = ops.find(o => o.id === props.selectedOpeningId)
  return sel ? openingMeasures(props.geometry, sel) : []
})

// UX6: an over-budget room is the isolated, visually distinct item on the plan.
// Amber warning triangle at the top-left (the ring owns the top-right), with a
// "!" glyph so the signal is never color-only (Build Conventions).
const warn = computed(() => ({
  cx: props.geometry.x + 15,
  cy: props.geometry.y + 15,
}))

const status = computed(() => effectiveRoomStatus(props.room.status, props.progress))
const style = computed(() => STATUS_STYLES[status.value])

const showLabel = computed(() => !covered.value && props.geometry.h >= 36 && props.geometry.w >= 48)
const showRing = computed(() => !covered.value && props.geometry.w >= 60 && props.geometry.h >= 60)
const ring = computed(() => ({
  cx: props.geometry.x + props.geometry.w - 21,
  cy: props.geometry.y + 21,
  color: props.progress.complete ? RING_DONE : RING_ARC,
}))

const label = computed(
  () => (status.value === 'done' ? '✓ ' : '') + props.room.name,
)

// When a higher room overlaps this one, its effective area drops below the raw
// footprint — surface that on the plan so the cut is visible, not just implied.
const footprintArea = computed(() => sqFt(props.room.geometry))
const effectiveArea = computed(() => sqFt(props.geometry))
const bitten = computed(() => effectiveArea.value < footprintArea.value)

// UX3: celebrate the moment progress crosses to 100% — not on initial load of
// an already-done room.
const celebrating = ref(false)
watch(
  () => props.progress.complete,
  (now, was) => {
    if (now && was === false) {
      celebrating.value = true
      setTimeout(() => (celebrating.value = false), 1300)
    }
  },
)
</script>

<template>
  <g
    :data-room-id="room.id"
    class="fp-room"
    :aria-label="`${room.name}, ${dimsLabel(geometry)}, ${sqFt(geometry)} sq ft, ${progress.pct}% complete`"
  >
    <path
      class="fp-room__rect"
      :class="{ 'fp-room__rect--celebrate': celebrating }"
      :d="roomPath"
      fill-rule="evenodd"
      :fill="style.fill"
      :stroke="style.stroke"
      :stroke-width="selected ? 4 : 2.5"
      :stroke-dasharray="style.dash"
      stroke-linejoin="round"
    />
    <!-- Structural walls + door/window openings cut into them -->
    <FloorplanPrims v-if="walls.length" :prims="walls" />
    <g
      v-for="o in openings"
      :key="o.op.id"
      :data-opening-id="o.op.id"
      class="fp-opening"
    >
      <!-- transparent grab target along the wall -->
      <rect :x="o.hit.x" :y="o.hit.y" :width="o.hit.w" :height="o.hit.h" fill="transparent" />
      <FloorplanPrims :prims="o.prims" />
      <rect
        v-if="o.op.id === selectedOpeningId"
        :x="o.hit.x"
        :y="o.hit.y"
        :width="o.hit.w"
        :height="o.hit.h"
        rx="2"
        fill="none"
        :stroke="FIXTURE_SELECTED"
        stroke-width="1.5"
        stroke-dasharray="4 3"
        pointer-events="none"
      />
    </g>
    <!-- live measurement labels for the selected opening -->
    <text
      v-for="(m, i) in openingMeasureLabels"
      :key="`om${i}`"
      class="fp-room__measure"
      :x="m.x"
      :y="m.y"
      text-anchor="middle"
      font-size="11"
      font-weight="600"
      :fill="LABEL_COLOR"
    >{{ m.text }}</text>
    <template v-if="showLabel">
      <text
        class="fp-room__text"
        :x="geometry.x + geometry.w / 2"
        :y="geometry.y + geometry.h / 2 - 2"
        text-anchor="middle"
        font-size="13"
        font-weight="600"
      >{{ label }}</text>
      <text
        v-if="showDims"
        class="fp-room__text fp-room__text--dim"
        :x="geometry.x + geometry.w / 2"
        :y="geometry.y + geometry.h / 2 + 14"
        text-anchor="middle"
        font-size="11"
      >{{ dimsLabel(geometry) }}</text>
      <!-- Effective area drops when a higher room bites this one (overlap). -->
      <text
        v-if="showDims && bitten && geometry.h >= 54"
        class="fp-room__text fp-room__text--cut"
        :x="geometry.x + geometry.w / 2"
        :y="geometry.y + geometry.h / 2 + 28"
        text-anchor="middle"
        font-size="11"
        font-weight="600"
      >{{ effectiveArea }} sq ft</text>
    </template>
    <!-- Too small for a label: a done room still gets its non-color channel. -->
    <text
      v-else-if="status === 'done' && !covered"
      class="fp-room__text"
      :x="geometry.x + geometry.w / 2"
      :y="geometry.y + geometry.h / 2 + 4"
      text-anchor="middle"
      :font-size="Math.min(13, geometry.h - 4, geometry.w - 4)"
      font-weight="600"
    >✓</text>
    <!-- Fixtures / obstructions sit on the floor; selectable + draggable -->
    <FloorplanFixture
      v-for="f in fixtures"
      :key="f.id"
      :room-geometry="geometry"
      :fixture="f"
      :selected="f.id === selectedFixtureId"
      :show-size="dimDetail === 'all'"
    />
    <g v-if="showRing" class="fp-room__ring">
      <title>{{ progress.pct }}% complete ({{ progress.done }}/{{ progress.total }})</title>
      <circle :cx="ring.cx" :cy="ring.cy" r="13" fill="none" :stroke="RING_TRACK" stroke-width="4" />
      <!-- Butt cap at 0%: a zero-length dash with a round cap paints a dot,
           which would read as nonzero progress. -->
      <circle
        :cx="ring.cx"
        :cy="ring.cy"
        r="13"
        fill="none"
        :stroke="ring.color"
        stroke-width="4"
        pathLength="100"
        :stroke-dasharray="`${progress.pct} 100`"
        :stroke-linecap="progress.pct > 0 ? 'round' : 'butt'"
        :transform="`rotate(-90 ${ring.cx} ${ring.cy})`"
      />
    </g>
    <g v-if="overBudget && showLabel" class="fp-room__warn">
      <title>Over budget</title>
      <path
        :d="`M ${warn.cx} ${warn.cy - 9} L ${warn.cx + 9} ${warn.cy + 7} L ${warn.cx - 9} ${warn.cy + 7} Z`"
        fill="#b26a00"
        stroke="#fff"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <text
        :x="warn.cx"
        :y="warn.cy + 6"
        text-anchor="middle"
        font-size="11"
        font-weight="700"
        fill="#fff"
      >!</text>
    </g>
  </g>
</template>

<style scoped>
.fp-room {
  cursor: move;
}
.fp-room__rect {
  transition: fill 0.4s ease, stroke 0.4s ease, stroke-width 0.15s ease;
  transform-box: fill-box;
  transform-origin: center;
}
.fp-room__rect--celebrate {
  animation: fp-celebrate 1.2s ease;
}
.fp-room__text {
  fill: #1a1c1e;
  pointer-events: none;
  user-select: none;
  font-family: system-ui, sans-serif;
}
.fp-room__text--dim {
  opacity: 0.75;
}
.fp-room__text--cut {
  fill: #1565c0;
}
.fp-opening {
  cursor: move;
}
.fp-room__measure {
  pointer-events: none;
  user-select: none;
  font-family: system-ui, sans-serif;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
  stroke-linejoin: round;
}
.fp-room__ring circle {
  transition: stroke-dasharray 0.5s ease, stroke 0.4s ease;
}
@keyframes fp-celebrate {
  0% { transform: scale(1); }
  35% { transform: scale(1.045); }
  100% { transform: scale(1); }
}
</style>
