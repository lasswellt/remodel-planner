<script setup lang="ts">
import type { Fixture, FixtureKind, Geometry, Opening, OpeningKind, Room } from '~/models'
import type { DimDetail, FloorplanTool, HandleId } from '~/composables/useFloorplan'
import { GRID_MAJOR, GRID_MINOR, PLAN_BG } from '~/utils/floorplan-style'
import { effectiveGeometry, WORLD } from '~/utils/geometry'

// The SVG floorplan surface: grid, room rects (with live overlap auto-cut),
// walls/openings/fixtures, draw preview, resize handles, and the ghost-room
// empty state (UX10). All gesture logic lives in useFloorplan; persistence is
// emitted upward.
const props = defineProps<{
  rooms: Room[]
  gridStep: number
  openingKind: OpeningKind
  fixtureKind: FixtureKind
  dimDetail: DimDetail
}>()

const emit = defineEmits<{
  create: [geometry: Geometry]
  commit: [id: string, geometry: Geometry]
  deleteRequest: [id: string]
  addNotch: [roomId: string, notch: { x: number, y: number, w: number, h: number }]
  bringToFront: [id: string]
  addOpening: [roomId: string, opening: Omit<Opening, 'id'>]
  commitOpening: [roomId: string, opening: Opening]
  deleteOpening: [roomId: string, openingId: string]
  addFixture: [roomId: string, fixture: Omit<Fixture, 'id'>]
  commitFixture: [roomId: string, fixture: Fixture]
  deleteFixture: [roomId: string, fixtureId: string]
  requestEdit: [id: string]
  pointerStart: []
}>()

const selectedId = defineModel<string | null>('selected', { default: null })
const selectedFixtureId = defineModel<string | null>('selectedFixture', { default: null })
const selectedOpeningId = defineModel<string | null>('selectedOpening', { default: null })
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
  selectedFixtureId,
  selectedOpeningId,
  openingKind: toRef(props, 'openingKind'),
  fixtureKind: toRef(props, 'fixtureKind'),
  onCreate: geo => emit('create', geo),
  onCommit: (id, geo) => emit('commit', id, geo),
  onDeleteRequest: id => emit('deleteRequest', id),
  onAddNotch: (roomId, notch) => emit('addNotch', roomId, notch),
  onBringToFront: id => emit('bringToFront', id),
  onAddOpening: (roomId, opening) => emit('addOpening', roomId, opening),
  onCommitOpening: (roomId, opening) => emit('commitOpening', roomId, opening),
  onDeleteOpening: (roomId, openingId) => emit('deleteOpening', roomId, openingId),
  onAddFixture: (roomId, fixture) => emit('addFixture', roomId, fixture),
  onCommitFixture: (roomId, fixture) => emit('commitFixture', roomId, fixture),
  onDeleteFixture: (roomId, fixtureId) => emit('deleteFixture', roomId, fixtureId),
  onRequestEdit: id => emit('requestEdit', id),
  onPointerStart: () => emit('pointerStart'),
})

// Keyboard works while the plan is on screen: arrows nudge, R rotates, Del
// removes (confirmed upstream), Esc deselects / cancels drawing.
useEventListener(window, 'keydown', fp.onKeydown)

// The summary panel's footer rotate button rotates the ROOM (the fixture editor
// has its own rotate); routed here so it includes any in-flight overlay/nudge.
defineExpose({ rotateRoom: fp.rotateSelected })

// Live stacking snapshot: each room with its live geometry and effective z. The
// room currently being dragged is forced topmost so it bites overlaps the
// instant it is grabbed, without waiting for the async bring-to-front write.
const liveStack = computed(() => {
  const movingId = fp.overlay.value?.id ?? null
  return props.rooms.map((room, i) => ({
    room,
    i,
    z: room.id === movingId ? Number.MAX_SAFE_INTEGER : (room.z ?? 0),
    geometry: fp.liveGeometry(room),
  }))
})

// Effective geometry per room: footprint with higher rooms' overlaps bitten out
// (non-destructive), recomputed live as rooms drag. `rooms` is one floor.
const effGeo = computed<Record<string, Geometry>>(() => {
  const live = liveStack.value.map(s => ({ id: s.room.id, z: s.z, geometry: s.geometry }))
  const map: Record<string, Geometry> = {}
  for (const r of live) map[r.id] = effectiveGeometry(r, live)
  return map
})
function geoFor(room: Room): Geometry {
  return effGeo.value[room.id] ?? fp.liveGeometry(room)
}

// Paint rooms in stacking order (z asc, ties by array order) so a higher room —
// the one that bites the overlap — is drawn on top of the room it covers.
const roomsByZ = computed(() =>
  [...liveStack.value].sort((a, b) => (a.z - b.z) || (a.i - b.i)).map(s => s.room),
)

const HANDLE = 12
// Touch hit area around each handle (world units). The plan is fit-to-width, so
// on a phone 1 unit ≈ 0.5px — a 12-unit handle is ~6px, far too small to grab.
// A transparent ~40-unit target (~20px on mobile) sits under the 12-unit visual.
const HIT = 40
// Resize handles target the selected room; hidden while a fixture is selected
// so its drag/rotate isn't crowded by room handles.
const handles = computed<{ id: HandleId, x: number, y: number, cursor: string }[]>(() => {
  const room = fp.selectedRoom.value
  if (!room || selectedFixtureId.value) return []
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
  <div class="fp-canvas-wrap">
  <svg
    ref="svgEl"
    class="fp-canvas"
    :class="{
      'fp-canvas--draw': tool === 'draw',
      'fp-canvas--notch': tool === 'notch',
      'fp-canvas--place': tool === 'opening' || tool === 'fixture',
    }"
    :viewBox="fp.viewBox.value"
    role="application"
    aria-label="Floorplan canvas. Use the draw tool to add rooms; arrow keys nudge the selected room. Pinch or scroll to zoom."
    @pointerdown="fp.onPointerDown"
    @pointermove="fp.onPointerMove"
    @pointerup="fp.onPointerUp"
    @pointercancel="fp.onPointerUp"
    @wheel.prevent="fp.onWheel"
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
      v-for="room in roomsByZ"
      :key="room.id"
      :room="room"
      :geometry="geoFor(room)"
      :progress="rollup.byRoom(room.id)"
      :over-budget="budget.overBudgetRoomIds.value.has(room.id)"
      :selected="room.id === selectedId"
      :selected-fixture-id="selectedFixtureId"
      :selected-opening-id="selectedOpeningId"
      :dim-detail="dimDetail"
    />

    <!-- Draw preview -->
    <rect
      v-if="fp.draftRect.value"
      :x="fp.draftRect.value.x"
      :y="fp.draftRect.value.y"
      :width="fp.draftRect.value.w"
      :height="fp.draftRect.value.h"
      rx="3"
      fill="#1E3A5F"
      fill-opacity="0.08"
      stroke="#1E3A5F"
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

    <!-- Resize handles for the selected room: an enlarged transparent touch
         target carries the pointer hook; the small visual sits on top. -->
    <g v-for="h in handles" :key="h.id">
      <rect
        :data-handle="h.id"
        :x="h.x - HIT / 2"
        :y="h.y - HIT / 2"
        :width="HIT"
        :height="HIT"
        fill="transparent"
        :style="{ cursor: h.cursor }"
      />
      <rect
        :x="h.x - HANDLE / 2"
        :y="h.y - HANDLE / 2"
        :width="HANDLE"
        :height="HANDLE"
        rx="2"
        fill="#FFFFFF"
        stroke="#1E3A5F"
        stroke-width="2"
        pointer-events="none"
      />
    </g>

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
    <div class="fp-zoom">
      <v-btn icon="mdi-magnify-plus-outline" size="small" variant="tonal" aria-label="Zoom in" @click="fp.zoomIn" />
      <v-btn icon="mdi-magnify-minus-outline" size="small" variant="tonal" aria-label="Zoom out" @click="fp.zoomOut" />
      <v-btn v-if="fp.zoomed.value" icon="mdi-fit-to-screen-outline" size="small" variant="tonal" aria-label="Fit plan to screen" @click="fp.resetView" />
    </div>
  </div>
</template>

<style scoped>
.fp-canvas-wrap {
  position: relative;
}
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
.fp-zoom {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 2;
}
.fp-zoom :deep(.v-btn) {
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 4px rgba(16, 34, 54, 0.18);
}
.fp-canvas--draw,
.fp-canvas--draw :deep(.fp-room),
.fp-canvas--notch,
.fp-canvas--notch :deep(.fp-room),
.fp-canvas--place,
.fp-canvas--place :deep(.fp-room),
.fp-canvas--place :deep(.fp-fixture) {
  cursor: crosshair;
}
.fp-ghost {
  cursor: pointer;
}
</style>
