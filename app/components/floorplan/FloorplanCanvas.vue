<script setup lang="ts">
import type { Geometry, Room } from '~/models'
import type { FloorplanTool, HandleId } from '~/composables/useFloorplan'
import { GRID_MAJOR, GRID_MINOR, PLAN_BG } from '~/utils/floorplan-style'
import { WORLD } from '~/utils/geometry'

// The SVG floorplan surface: grid, room rects, draw preview, resize handles,
// and the ghost-room empty state (UX10). All gesture logic lives in
// useFloorplan; persistence is emitted upward.
const props = defineProps<{
  rooms: Room[]
  gridStep: number
}>()

const emit = defineEmits<{
  create: [geometry: Geometry]
  commit: [id: string, geometry: Geometry]
  deleteRequest: [id: string]
  addNotch: [roomId: string, notch: { x: number, y: number, w: number, h: number }]
}>()

const selectedId = defineModel<string | null>('selected', { default: null })
const tool = defineModel<FloorplanTool>('tool', { default: 'select' })

const svgEl = ref<SVGSVGElement | null>(null)
const rollup = useRollup()
const budget = useProjectBudget()

const fp = useFloorplan({
  svgEl,
  rooms: toRef(props, 'rooms'),
  tool,
  gridStep: toRef(props, 'gridStep'),
  selectedId,
  onCreate: geo => emit('create', geo),
  onCommit: (id, geo) => emit('commit', id, geo),
  onDeleteRequest: id => emit('deleteRequest', id),
  onAddNotch: (roomId, notch) => emit('addNotch', roomId, notch),
})

// Keyboard works while the plan is on screen: arrows nudge, R rotates, Del
// removes (confirmed upstream), Esc deselects / cancels drawing.
useEventListener(window, 'keydown', fp.onKeydown)

// The summary panel's rotate button routes through here so the rotation is
// computed from the live overlay (including any pending nudge).
defineExpose({ rotateSelected: fp.rotateSelected })

const HANDLE = 12
const handles = computed<{ id: HandleId, x: number, y: number, cursor: string }[]>(() => {
  const room = fp.selectedRoom.value
  if (!room) return []
  const g = fp.liveGeometry(room)
  return [
    { id: 'nw', x: g.x, y: g.y, cursor: 'nwse-resize' },
    { id: 'ne', x: g.x + g.w, y: g.y, cursor: 'nesw-resize' },
    { id: 'sw', x: g.x, y: g.y + g.h, cursor: 'nesw-resize' },
    { id: 'se', x: g.x + g.w, y: g.y + g.h, cursor: 'nwse-resize' },
  ]
})

const major = computed(() => props.gridStep * 4)
const ghost = computed(() => props.rooms.length === 0)
</script>

<template>
  <svg
    ref="svgEl"
    class="fp-canvas"
    :class="{ 'fp-canvas--draw': tool === 'draw', 'fp-canvas--notch': tool === 'notch' }"
    :viewBox="`0 0 ${WORLD.w} ${WORLD.h}`"
    role="application"
    aria-label="Floorplan canvas. Use the draw tool to add rooms; arrow keys nudge the selected room."
    @pointerdown="fp.onPointerDown"
    @pointermove="fp.onPointerMove"
    @pointerup="fp.onPointerUp"
    @pointercancel="fp.onPointerUp"
  >
    <defs>
      <pattern id="fp-grid-minor" :width="gridStep" :height="gridStep" patternUnits="userSpaceOnUse">
        <path :d="`M ${gridStep} 0 L 0 0 0 ${gridStep}`" fill="none" :stroke="GRID_MINOR" stroke-width="0.5" />
      </pattern>
      <pattern id="fp-grid-major" :width="major" :height="major" patternUnits="userSpaceOnUse">
        <rect :width="major" :height="major" fill="url(#fp-grid-minor)" />
        <path :d="`M ${major} 0 L 0 0 0 ${major}`" fill="none" :stroke="GRID_MAJOR" stroke-width="1" />
      </pattern>
    </defs>

    <rect :width="WORLD.w" :height="WORLD.h" :fill="PLAN_BG" />
    <rect :width="WORLD.w" :height="WORLD.h" fill="url(#fp-grid-major)" />

    <FloorplanRoomRect
      v-for="room in rooms"
      :key="room.id"
      :room="room"
      :geometry="fp.liveGeometry(room)"
      :progress="rollup.byRoom(room.id)"
      :over-budget="budget.overBudgetRoomIds.value.has(room.id)"
      :selected="room.id === selectedId"
    />

    <!-- Draw preview -->
    <rect
      v-if="fp.draftRect.value"
      :x="fp.draftRect.value.x"
      :y="fp.draftRect.value.y"
      :width="fp.draftRect.value.w"
      :height="fp.draftRect.value.h"
      rx="3"
      fill="#1565C0"
      fill-opacity="0.08"
      stroke="#1565C0"
      stroke-width="2"
      stroke-dasharray="6 4"
    />

    <!-- Notch preview -->
    <rect
      v-if="fp.notchDraft.value"
      :x="fp.notchDraft.value.x"
      :y="fp.notchDraft.value.y"
      :width="fp.notchDraft.value.w"
      :height="fp.notchDraft.value.h"
      fill="#B71C1C"
      fill-opacity="0.15"
      stroke="#B71C1C"
      stroke-width="2"
      stroke-dasharray="4 3"
    />

    <!-- Snap guides: the edge lines the gesture is currently magnetized to -->
    <line
      v-if="fp.snapGuides.value.x !== null"
      :x1="fp.snapGuides.value.x"
      y1="0"
      :x2="fp.snapGuides.value.x"
      :y2="WORLD.h"
      stroke="#E91E63"
      stroke-width="1"
      stroke-dasharray="5 4"
      pointer-events="none"
    />
    <line
      v-if="fp.snapGuides.value.y !== null"
      x1="0"
      :y1="fp.snapGuides.value.y"
      :x2="WORLD.w"
      :y2="fp.snapGuides.value.y"
      stroke="#E91E63"
      stroke-width="1"
      stroke-dasharray="5 4"
      pointer-events="none"
    />

    <!-- Resize handles for the selected room -->
    <rect
      v-for="h in handles"
      :key="h.id"
      :data-handle="h.id"
      :x="h.x - HANDLE / 2"
      :y="h.y - HANDLE / 2"
      :width="HANDLE"
      :height="HANDLE"
      rx="2"
      fill="#FFFFFF"
      stroke="#1565C0"
      stroke-width="2"
      :style="{ cursor: h.cursor }"
    />

    <!-- UX10: an empty floor teaches — ghost room + draw prompt -->
    <g
      v-if="ghost"
      class="fp-ghost"
      role="button"
      aria-label="Start drawing your first room"
      @click="tool = 'draw'"
    >
      <!-- fill=transparent (not none) so the whole ghost area is clickable -->
      <rect
        :x="WORLD.w / 2 - 96"
        :y="WORLD.h / 2 - 78"
        width="192"
        height="132"
        rx="6"
        fill="transparent"
        stroke="#8A93A1"
        stroke-width="2"
        stroke-dasharray="10 8"
      />
      <text :x="WORLD.w / 2" :y="WORLD.h / 2 - 6" text-anchor="middle" font-size="15" font-weight="600" fill="#5B7083">
        Draw your first room
      </text>
      <text :x="WORLD.w / 2" :y="WORLD.h / 2 + 16" text-anchor="middle" font-size="11" fill="#8A93A1">
        Click here, then drag on the grid
      </text>
    </g>
  </svg>
</template>

<style scoped>
.fp-canvas {
  display: block;
  width: 100%;
  height: auto;
  max-height: calc(100vh - 240px);
  touch-action: none;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: #fff;
}
.fp-canvas--draw,
.fp-canvas--draw :deep(.fp-room),
.fp-canvas--notch,
.fp-canvas--notch :deep(.fp-room) {
  cursor: crosshair;
}
.fp-ghost {
  cursor: pointer;
}
</style>
