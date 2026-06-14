<script setup lang="ts">
import type { Prim } from '~/utils/floorplan-draw'

// Renders renderer-agnostic Prim descriptors as SVG elements. Split per type so
// vue-tsc gets concrete props (no union-narrowing in the template). Used for
// wall bands, door/window symbols, and fixture detail.
const props = defineProps<{ prims: Prim[] }>()

type By<K extends Prim['t']> = Extract<Prim, { t: K }>
const lines = computed(() => props.prims.filter((p): p is By<'line'> => p.t === 'line'))
const rects = computed(() => props.prims.filter((p): p is By<'rect'> => p.t === 'rect'))
const paths = computed(() => props.prims.filter((p): p is By<'path'> => p.t === 'path'))
const ellipses = computed(() => props.prims.filter((p): p is By<'ellipse'> => p.t === 'ellipse'))
</script>

<template>
  <g>
    <rect
      v-for="(p, i) in rects"
      :key="`r${i}`"
      :x="p.x"
      :y="p.y"
      :width="p.w"
      :height="p.h"
      :rx="p.rx"
      :fill="p.fill ?? 'none'"
      :stroke="p.stroke"
      :stroke-width="p.sw ?? 1"
      :stroke-dasharray="p.dash"
    />
    <line
      v-for="(p, i) in lines"
      :key="`l${i}`"
      :x1="p.x1"
      :y1="p.y1"
      :x2="p.x2"
      :y2="p.y2"
      :stroke="p.stroke"
      :stroke-width="p.sw ?? 1"
      :stroke-dasharray="p.dash"
    />
    <path
      v-for="(p, i) in paths"
      :key="`p${i}`"
      :d="p.d"
      :fill="p.fill ?? 'none'"
      :stroke="p.stroke"
      :stroke-width="p.sw ?? 1"
      :stroke-dasharray="p.dash"
    />
    <ellipse
      v-for="(p, i) in ellipses"
      :key="`e${i}`"
      :cx="p.cx"
      :cy="p.cy"
      :rx="p.rx"
      :ry="p.ry"
      :fill="p.fill ?? 'none'"
      :stroke="p.stroke"
      :stroke-width="p.sw ?? 1"
    />
  </g>
</template>
