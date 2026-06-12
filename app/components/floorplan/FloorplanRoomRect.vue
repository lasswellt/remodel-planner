<script setup lang="ts">
import type { Geometry, Room } from '~/models'
import { sqFt } from '~/utils/geometry'
import { RING_ARC, RING_DONE, RING_TRACK, STATUS_STYLES } from '~/utils/floorplan-style'
import type { Progress } from '~/utils/rollup'
import { effectiveRoomStatus } from '~/utils/rollup'

// One room on the plan. Visual status encoding is never color-only (Build
// Conventions): planned = dashed outline, in-progress = solid, done = solid +
// "✓" in the label. The progress ring is always visible (UX1) when the rect
// is big enough to host it; hitting 100% plays a brief one-time celebration
// transition (UX3).
const props = defineProps<{
  room: Room
  geometry: Geometry
  progress: Progress
  selected: boolean
}>()

const status = computed(() => effectiveRoomStatus(props.room.status, props.progress))
const style = computed(() => STATUS_STYLES[status.value])

const showLabel = computed(() => props.geometry.h >= 36 && props.geometry.w >= 48)
const showRing = computed(() => props.geometry.w >= 60 && props.geometry.h >= 60)
const ring = computed(() => ({
  cx: props.geometry.x + props.geometry.w - 21,
  cy: props.geometry.y + 21,
  color: props.progress.complete ? RING_DONE : RING_ARC,
}))

const label = computed(
  () => (status.value === 'done' ? '✓ ' : '') + props.room.name,
)

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
    :aria-label="`${room.name}, ${sqFt(geometry)} sq ft, ${progress.pct}% complete`"
  >
    <rect
      class="fp-room__rect"
      :class="{ 'fp-room__rect--celebrate': celebrating }"
      :x="geometry.x"
      :y="geometry.y"
      :width="geometry.w"
      :height="geometry.h"
      rx="3"
      :fill="style.fill"
      :stroke="style.stroke"
      :stroke-width="selected ? 4 : 2.5"
      :stroke-dasharray="style.dash"
    />
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
        class="fp-room__text fp-room__text--dim"
        :x="geometry.x + geometry.w / 2"
        :y="geometry.y + geometry.h / 2 + 14"
        text-anchor="middle"
        font-size="11"
      >{{ sqFt(geometry) }} sq ft</text>
    </template>
    <!-- Too small for a label: a done room still gets its non-color channel. -->
    <text
      v-else-if="status === 'done'"
      class="fp-room__text"
      :x="geometry.x + geometry.w / 2"
      :y="geometry.y + geometry.h / 2 + 4"
      text-anchor="middle"
      :font-size="Math.min(13, geometry.h - 4, geometry.w - 4)"
      font-weight="600"
    >✓</text>
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
.fp-room__ring circle {
  transition: stroke-dasharray 0.5s ease, stroke 0.4s ease;
}
@keyframes fp-celebrate {
  0% { transform: scale(1); }
  35% { transform: scale(1.045); }
  100% { transform: scale(1); }
}
</style>
