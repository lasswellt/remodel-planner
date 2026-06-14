<script setup lang="ts">
import { useCollection, useFirestore } from 'vuefire'
import type { DimensionBasis, DoorType, Fixture, HingeSide, Opening, Room, RoomStatus, RoomType, SwingDir, WallSide } from '~/models'
import { ROOM_TYPE_ICONS, ROOM_TYPE_OPTIONS } from '~/config/rooms'
import { FIXTURE_CATALOG, fixtureLabel } from '~/config/fixtures'
import {
  basisWH,
  DEFAULT_GRID_STEP,
  dimsLabelWH,
  footprintFromBasis,
  inchesToFeetInput,
  interiorWH,
  parseFeetToInches,
  sqFt,
  usableSqFt,
  WORLD,
} from '~/utils/geometry'
import { budgetLinesCol } from '~/utils/firestore-paths'
import { formatMoney } from '~/utils/money'
import { useRoomsStore } from '~/stores/rooms'
import { useProjectStore } from '~/stores/project'

const props = defineProps<{ room: Room, selectedFixtureId?: string | null, selectedOpeningId?: string | null }>()
const emit = defineEmits<{
  close: []
  deleteRequest: [id: string]
  rotate: [id: string]
  activateNotchTool: []
  deleteNotch: [roomId: string, notchId: string]
  updateFixture: [roomId: string, fixtureId: string, patch: Partial<Fixture>]
  deleteFixture: [roomId: string, fixtureId: string]
  selectFixture: [id: string | null]
  selectOpening: [id: string | null]
}>()

const db = useFirestore()
const projectStore = useProjectStore()
const roomsStore = useRoomsStore()
const rollup = useRollup()
const selections = useProjectSelections()

const overdueSelections = computed(() =>
  selections.byRoom(props.room.id).filter(s => selections.isSelectionOverdue(s)),
)

const progress = computed(() => rollup.byRoom(props.room.id))
const nextTask = computed(() => rollup.nextTask(props.room.id))
const roomTasks = computed(() =>
  rollup.tasks.value.filter(t => t.roomId === props.room.id),
)

const linesSource = computed(() =>
  projectStore.activeOwnerUid
    ? budgetLinesCol(db, projectStore.activeOwnerUid, props.room.projectId, props.room.id)
    : null,
)
const budgetLines = useCollection(linesSource, { ssrKey: 'panel-budget' })

// UX7: lead with remaining (estimate − spent), not with spent.
const budget = computed(() => {
  const estimate = budgetLines.value.reduce((sum, l) => sum + l.estimateCents, 0)
  const spent = budgetLines.value.reduce((sum, l) => sum + (l.actualCents ?? 0), 0)
  return { estimate, spent, remaining: estimate - spent }
})

const editingName = ref(false)
const nameDraft = ref('')

function startNameEdit() {
  nameDraft.value = props.room.name
  editingName.value = true
}
async function saveName() {
  editingName.value = false
  const name = nameDraft.value.trim()
  if (name && name !== props.room.name) await roomsStore.updateRoom(props.room.id, { name })
}

const geo = computed(() => props.room.geometry)
const basis = computed<DimensionBasis>(() => geo.value.basis ?? 'exterior')
const basisDims = computed(() => basisWH(geo.value))
const grossArea = computed(() => sqFt(geo.value))
const usableArea = computed(() => usableSqFt(geo.value))
const hasWalls = computed(() => {
  const w = geo.value.walls
  return !!w && (w.n > 0 || w.s > 0 || w.e > 0 || w.w > 0)
})

const editingDims = ref(false)
const wDraft = ref('')
const hDraft = ref('')

function startDimsEdit() {
  wDraft.value = inchesToFeetInput(basisDims.value.w)
  hDraft.value = inchesToFeetInput(basisDims.value.h)
  editingDims.value = true
}

async function saveDims() {
  editingDims.value = false
  const bw = parseFeetToInches(wDraft.value, DEFAULT_GRID_STEP, WORLD.w)
  const bh = parseFeetToInches(hDraft.value, DEFAULT_GRID_STEP, WORLD.h)
  if (bw === null || bh === null) return
  // Interpret the entered W/H in the active basis, then store the footprint.
  const fp = footprintFromBasis(geo.value, bw, bh)
  const w = Math.min(WORLD.w, fp.w)
  const h = Math.min(WORLD.h, fp.h)
  if (w !== geo.value.w || h !== geo.value.h) {
    await roomsStore.updateRoom(props.room.id, { geometry: { ...geo.value, w, h } })
  }
}

// ---- walls / basis ----
const WALL_SIDE_LABELS: Record<WallSide, string> = { n: 'Top', s: 'Bottom', w: 'Left', e: 'Right' }
const WALL_SIDES: WallSide[] = ['n', 's', 'e', 'w']

function setWall(side: WallSide, value: number | string) {
  const v = Math.max(0, Number(value) || 0)
  const walls = { ...(geo.value.walls ?? { n: 0, s: 0, e: 0, w: 0 }), [side]: v }
  roomsStore.updateRoom(props.room.id, { geometry: { ...geo.value, walls } })
}
function setAllWalls(v: number) {
  roomsStore.updateRoom(props.room.id, { geometry: { ...geo.value, walls: { n: v, s: v, e: v, w: v } } })
}
function setBasis(b: DimensionBasis) {
  if (b && b !== basis.value) roomsStore.updateRoom(props.room.id, { geometry: { ...geo.value, basis: b } })
}

// ---- openings ----
const openings = computed<Opening[]>(() => geo.value.openings ?? [])
const DOOR_TYPE_ITEMS: { value: DoorType, title: string }[] = [
  { value: 'single', title: 'Single' },
  { value: 'double', title: 'Double' },
  { value: 'sliding', title: 'Sliding' },
  { value: 'pocket', title: 'Pocket' },
  { value: 'bifold', title: 'Bifold' },
  { value: 'cased-opening', title: 'Cased opening' },
]
const HINGE_ITEMS: { value: HingeSide, title: string }[] = [
  { value: 'left', title: 'Hinge left' },
  { value: 'right', title: 'Hinge right' },
]
const SWING_ITEMS: { value: SwingDir, title: string }[] = [
  { value: 'in', title: 'Swing in' },
  { value: 'out', title: 'Swing out' },
]
const WALL_NAME: Record<WallSide, string> = { n: 'top', s: 'bottom', w: 'left', e: 'right' }

// Wall length the opening slides along (n/s run the room width, e/w the height).
function wallLen(wall: WallSide): number {
  return wall === 'n' || wall === 's' ? geo.value.w : geo.value.h
}

function updateOpening(id: string, patch: Partial<Opening>) {
  roomsStore.updateRoom(props.room.id, {
    geometry: {
      ...geo.value,
      openings: openings.value.map((o) => {
        if (o.id !== id) return o
        const next = { ...o, ...patch }
        // Keep the opening fully on its wall after a width/position change.
        next.offset = Math.min(Math.max(0, next.offset), Math.max(0, wallLen(next.wall) - next.width))
        return next
      }),
    },
  })
}
function deleteOpening(id: string) {
  roomsStore.updateRoom(props.room.id, {
    geometry: { ...geo.value, openings: openings.value.filter(o => o.id !== id) },
  })
}

// ---- fixtures ----
const fixtures = computed<Fixture[]>(() => geo.value.fixtures ?? [])
const selFixture = computed<Fixture | null>(() => fixtures.value.find(f => f.id === props.selectedFixtureId) ?? null)

function editFixture(patch: Partial<Fixture>) {
  const f = selFixture.value
  if (!f) return
  const clean: Partial<Fixture> = { ...patch }
  if (clean.w !== undefined) clean.w = Math.max(6, Number(clean.w) || f.w)
  if (clean.h !== undefined) clean.h = Math.max(6, Number(clean.h) || f.h)
  emit('updateFixture', props.room.id, f.id, clean)
}
function rotateFixtureSel() {
  const f = selFixture.value
  if (f) emit('updateFixture', props.room.id, f.id, { rotation: ((f.rotation ?? 0) + 90) % 360 })
}

// Numeric value from a text-field change event, floored at `min`.
function numVal(e: Event, min: number, fallback: number): number {
  const v = Number((e.target as HTMLInputElement).value)
  return Number.isFinite(v) ? Math.max(min, v) : fallback
}

const statusItems: { value: RoomStatus, title: string }[] = [
  { value: 'planned', title: 'Planned' },
  { value: 'in-progress', title: 'In progress' },
  { value: 'done', title: 'Done' },
]
</script>

<template>
  <v-card class="room-panel" variant="flat" border>
    <v-card-item>
      <template #prepend>
        <v-icon :icon="ROOM_TYPE_ICONS[room.type]" class="mr-1" />
      </template>
      <v-card-title v-if="!editingName" class="d-flex align-center ga-1">
        <span class="text-truncate">{{ room.name }}</span>
        <v-btn
          icon="mdi-pencil-outline"
          size="x-small"
          variant="text"
          aria-label="Rename room"
          @click="startNameEdit"
        />
      </v-card-title>
      <v-text-field
        v-else
        v-model="nameDraft"
        density="compact"
        autofocus
        hide-details
        @keyup.enter="saveName"
        @blur="saveName"
      />
      <v-card-subtitle>
        <template v-if="!editingDims">
          <button
            class="dims-btn"
            type="button"
            :title="`Edit ${basis} dimensions (in feet)`"
            @click="startDimsEdit"
          >{{ dimsLabelWH(basisDims.w, basisDims.h) }}</button>
          <span v-if="hasWalls" class="text-caption text-medium-emphasis"> ({{ basis }})</span>
          · {{ grossArea }} sq ft<template v-if="hasWalls"> · {{ usableArea }} usable</template>
          · floor {{ room.floor }}
        </template>
        <div v-else class="d-flex align-center ga-1 mt-1">
          <v-text-field
            v-model="wDraft"
            density="compact"
            variant="outlined"
            hide-details
            label="W (ft)"
            type="number"
            min="1"
            step="0.5"
            style="max-width: 90px"
            autofocus
            @keyup.enter="saveDims"
            @blur="saveDims"
          />
          <span class="text-body-2">×</span>
          <v-text-field
            v-model="hDraft"
            density="compact"
            variant="outlined"
            hide-details
            label="H (ft)"
            type="number"
            min="1"
            step="0.5"
            style="max-width: 90px"
            @keyup.enter="saveDims"
            @blur="saveDims"
          />
          <span class="text-body-2 text-medium-emphasis ml-1">ft {{ basis }}</span>
        </div>
      </v-card-subtitle>
      <template #append>
        <v-btn
          icon="mdi-arrow-expand"
          size="small"
          variant="text"
          aria-label="Open room page"
          :to="`/rooms/${room.id}`"
        />
        <v-btn icon="mdi-close" size="small" variant="text" aria-label="Close panel" @click="emit('close')" />
      </template>
    </v-card-item>

    <v-card-text class="pt-0">
      <!-- Notches -->
      <div v-if="room.geometry.notches.length > 0 || true" class="mb-3">
        <div class="d-flex align-center justify-space-between mb-1">
          <span class="text-body-2">Notches</span>
          <v-btn
            size="x-small"
            variant="tonal"
            prepend-icon="mdi-scissors-cutting"
            class="text-none"
            @click="emit('activateNotchTool')"
          >Add notch</v-btn>
        </div>
        <v-chip-group v-if="room.geometry.notches.length > 0">
          <v-chip
            v-for="n in room.geometry.notches"
            :key="n.id"
            size="small"
            variant="tonal"
            closable
            @click:close="emit('deleteNotch', room.id, n.id)"
          >
            {{ dimsLabelWH(n.w, n.h) }}
          </v-chip>
        </v-chip-group>
        <p v-else class="text-body-2 text-medium-emphasis ma-0">
          No notches. Use the Notch tool or the button above to cut into this room.
        </p>
      </div>

      <!-- Walls & dimension basis -->
      <div class="mb-3">
        <div class="d-flex align-center justify-space-between mb-1">
          <span class="text-body-2">Walls &amp; dimensions</span>
          <v-btn-toggle
            :model-value="basis"
            mandatory
            density="compact"
            variant="outlined"
            @update:model-value="setBasis"
          >
            <v-btn value="exterior" size="x-small" class="text-none">Exterior</v-btn>
            <v-btn value="interior" size="x-small" class="text-none">Interior</v-btn>
          </v-btn-toggle>
        </div>
        <div class="d-flex flex-wrap ga-2">
          <v-text-field
            v-for="side in WALL_SIDES"
            :key="side"
            :model-value="geo.walls?.[side] ?? 0"
            :label="WALL_SIDE_LABELS[side]"
            type="number"
            min="0"
            step="0.5"
            suffix="″"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 86px"
            @change="(e: Event) => setWall(side, numVal(e, 0, geo.walls?.[side] ?? 0))"
          />
        </div>
        <div class="d-flex ga-1 mt-2">
          <v-btn size="x-small" variant="tonal" class="text-none" @click="setAllWalls(4.5)">Interior 4.5″</v-btn>
          <v-btn size="x-small" variant="tonal" class="text-none" @click="setAllWalls(6.5)">Exterior 6.5″</v-btn>
          <v-btn size="x-small" variant="text" class="text-none" @click="setAllWalls(0)">None</v-btn>
        </div>
        <p v-if="hasWalls" class="text-caption text-medium-emphasis mt-1 mb-0">
          Interior {{ dimsLabelWH(interiorWH(geo).w, interiorWH(geo).h) }} · {{ usableArea }} sq ft usable
        </p>
      </div>

      <!-- Openings (doors / windows) -->
      <div class="mb-3">
        <div class="d-flex align-center justify-space-between mb-1">
          <span class="text-body-2">Openings</span>
          <span class="text-caption text-medium-emphasis">Place with the Opening tool</span>
        </div>
        <p v-if="openings.length === 0" class="text-body-2 text-medium-emphasis ma-0">
          No doors or windows yet. Pick the Opening tool, choose Door or Window, then click a wall.
        </p>
        <v-expansion-panels v-else variant="accordion" multiple>
          <v-expansion-panel
            v-for="o in openings"
            :key="o.id"
            :class="{ 'opening-selected': o.id === selectedOpeningId }"
          >
            <v-expansion-panel-title @click="emit('selectOpening', o.id)">
              <v-icon :icon="o.kind === 'window' ? 'mdi-window-closed-variant' : 'mdi-door'" size="small" class="mr-2" />
              {{ o.kind === 'window' ? 'Window' : 'Door' }} · {{ WALL_NAME[o.wall] }} · {{ o.width }}″
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <p class="text-caption text-medium-emphasis mb-2 ma-0">
                Drag the opening on the plan to reposition it, or set the distance from the wall corner below.
              </p>
              <div class="d-flex flex-wrap ga-2">
                <v-text-field
                  :model-value="o.width"
                  label="Width"
                  type="number"
                  min="6"
                  step="1"
                  suffix="″"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="max-width: 96px"
                  @change="(e: Event) => updateOpening(o.id, { width: numVal(e, 6, o.width) })"
                />
                <v-text-field
                  :model-value="o.offset"
                  label="From corner"
                  type="number"
                  min="0"
                  step="1"
                  suffix="″"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="max-width: 120px"
                  @change="(e: Event) => updateOpening(o.id, { offset: numVal(e, 0, o.offset) })"
                />
                <template v-if="o.kind === 'door'">
                  <v-select
                    :model-value="o.doorType ?? 'single'"
                    :items="DOOR_TYPE_ITEMS"
                    label="Type"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="max-width: 150px"
                    @update:model-value="(v: DoorType) => updateOpening(o.id, { doorType: v })"
                  />
                  <v-select
                    v-if="(o.doorType ?? 'single') !== 'cased-opening'"
                    :model-value="o.hinge ?? 'left'"
                    :items="HINGE_ITEMS"
                    label="Hinge"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="max-width: 130px"
                    @update:model-value="(v: HingeSide) => updateOpening(o.id, { hinge: v })"
                  />
                  <v-select
                    v-if="(o.doorType ?? 'single') !== 'cased-opening'"
                    :model-value="o.swing ?? 'in'"
                    :items="SWING_ITEMS"
                    label="Swing"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="max-width: 130px"
                    @update:model-value="(v: SwingDir) => updateOpening(o.id, { swing: v })"
                  />
                </template>
                <v-text-field
                  v-else
                  :model-value="o.sill ?? 36"
                  label="Sill height"
                  type="number"
                  min="0"
                  step="1"
                  suffix="″"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="max-width: 120px"
                  @change="(e: Event) => updateOpening(o.id, { sill: numVal(e, 0, o.sill ?? 36) })"
                />
              </div>
              <div class="d-flex justify-end mt-2">
                <v-btn
                  size="x-small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-delete-outline"
                  class="text-none"
                  @click="deleteOpening(o.id)"
                >Remove</v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>

      <!-- Fixtures / obstructions -->
      <div class="mb-3">
        <div class="d-flex align-center justify-space-between mb-1">
          <span class="text-body-2">Fixtures</span>
          <span class="text-caption text-medium-emphasis">Place with the Fixture tool</span>
        </div>
        <p v-if="fixtures.length === 0" class="text-body-2 text-medium-emphasis ma-0">
          No fixtures yet. Pick the Fixture tool, choose one, then click inside the room.
        </p>
        <v-list v-else density="compact" class="py-0">
          <v-list-item
            v-for="f in fixtures"
            :key="f.id"
            :active="f.id === selectedFixtureId"
            @click="emit('selectFixture', f.id === selectedFixtureId ? null : f.id)"
          >
            <template #prepend>
              <v-icon :icon="FIXTURE_CATALOG[f.kind].icon" />
            </template>
            <v-list-item-title>{{ fixtureLabel(f.kind, f.label) }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ dimsLabelWH(f.w, f.h) }}<span v-if="f.rotation"> · {{ f.rotation }}°</span>
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                icon="mdi-delete-outline"
                size="x-small"
                variant="text"
                aria-label="Remove fixture"
                @click.stop="emit('deleteFixture', room.id, f.id)"
              />
            </template>
          </v-list-item>
        </v-list>
        <div v-if="selFixture" class="mt-2 pa-2 fixture-editor">
          <div class="d-flex flex-wrap ga-2 align-center">
            <v-text-field
              :model-value="selFixture.w"
              label="W"
              type="number"
              min="6"
              step="1"
              suffix="″"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 84px"
              @change="(e: Event) => editFixture({ w: numVal(e, 6, selFixture!.w) })"
            />
            <v-text-field
              :model-value="selFixture.h"
              label="H"
              type="number"
              min="6"
              step="1"
              suffix="″"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 84px"
              @change="(e: Event) => editFixture({ h: numVal(e, 6, selFixture!.h) })"
            />
            <v-text-field
              :model-value="selFixture.label ?? ''"
              label="Label"
              placeholder="(default)"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 130px"
              @change="(e: Event) => editFixture({ label: (e.target as HTMLInputElement).value })"
            />
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-rotate-right"
              class="text-none"
              @click="rotateFixtureSel"
            >Rotate</v-btn>
          </div>
        </div>
      </div>

      <div class="d-flex ga-2 mb-4">
        <v-select
          :model-value="room.type"
          :items="ROOM_TYPE_OPTIONS"
          label="Type"
          density="compact"
          hide-details
          @update:model-value="(v: RoomType) => roomsStore.updateRoom(room.id, { type: v })"
        />
        <v-select
          :model-value="room.status"
          :items="statusItems"
          label="Status"
          density="compact"
          hide-details
          @update:model-value="(v: RoomStatus) => roomsStore.updateRoom(room.id, { status: v })"
        />
      </div>

      <div class="d-flex align-center justify-space-between mb-1">
        <span class="text-body-2">Progress</span>
        <span class="text-body-2 font-weight-medium">
          {{ progress.pct }}% ({{ progress.done }}/{{ progress.total }})
        </span>
      </div>
      <v-progress-linear
        :model-value="progress.pct"
        :color="progress.complete ? 'success' : 'primary'"
        height="8"
        rounded
        class="mb-4"
      />

      <div class="mb-4">
        <div class="text-body-2 mb-1">Budget</div>
        <template v-if="budgetLines.length > 0">
          <div class="text-h6" :class="budget.remaining < 0 ? 'text-error' : 'text-success'">
            {{ formatMoney(Math.abs(budget.remaining)) }}
            {{ budget.remaining < 0 ? 'over' : 'remaining' }}
            <v-icon
              v-if="budget.remaining < 0"
              icon="mdi-alert-circle-outline"
              size="small"
              aria-label="Over budget"
            />
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ formatMoney(budget.spent) }} spent of {{ formatMoney(budget.estimate) }} estimated
          </div>
        </template>
        <p v-else class="text-body-2 text-medium-emphasis ma-0">
          No budget lines yet — the budget phase adds typical cost ranges per room type.
        </p>
      </div>

      <div class="mb-2">
        <div class="text-body-2 mb-1">Next task</div>
        <v-chip v-if="nextTask" size="small" variant="tonal" prepend-icon="mdi-arrow-right-circle-outline">
          {{ nextTask.label }} · {{ nextTask.phase }}
        </v-chip>
        <p v-else class="text-body-2 text-medium-emphasis ma-0">
          No open tasks. Templates seed phase-ordered tasks in the rooms phase.
        </p>
      </div>

      <!-- UX6: overdue selections are the salient warning on the panel. -->
      <v-alert
        v-if="overdueSelections.length > 0"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-2"
        icon="mdi-truck-alert-outline"
      >
        {{ overdueSelections.length }} overdue selection{{ overdueSelections.length === 1 ? '' : 's' }}:
        {{ overdueSelections.map(s => s.label).join(', ') }}
      </v-alert>

      <v-expansion-panels variant="accordion" class="mt-4" multiple>
        <v-expansion-panel>
          <v-expansion-panel-title>
            Checklist
            <v-chip size="x-small" class="ml-2" variant="tonal">
              {{ rollup.checklist.value.filter(c => c.roomId === room.id).length }}
            </v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <FloorplanRoomChecklistSection :room="room" />
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel>
          <v-expansion-panel-title>
            Budget lines
            <v-chip size="x-small" class="ml-2" variant="tonal">{{ budgetLines.length }}</v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-list v-if="budgetLines.length > 0" density="compact" class="py-0">
              <v-list-item
                v-for="line in budgetLines"
                :key="line.id"
                :title="line.label"
                :subtitle="line.category"
              >
                <template #append>
                  <span class="text-body-2">{{ formatMoney(line.actualCents ?? line.estimateCents) }}</span>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="text-body-2 text-medium-emphasis ma-0">No budget lines yet.</p>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel>
          <v-expansion-panel-title>
            Tasks
            <v-chip size="x-small" class="ml-2" variant="tonal">{{ roomTasks.length }}</v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-list v-if="roomTasks.length > 0" density="compact" class="py-0">
              <v-list-item
                v-for="task in roomTasks"
                :key="task.id"
                :title="task.label"
                :subtitle="task.phase"
              >
                <template #append>
                  <v-chip size="x-small" variant="tonal">{{ task.status }}</v-chip>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="text-body-2 text-medium-emphasis ma-0">No tasks yet.</p>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>

    <v-card-actions>
      <v-btn
        prepend-icon="mdi-rotate-right"
        variant="text"
        size="small"
        @click="emit('rotate', room.id)"
      >
        Rotate 90°
      </v-btn>
      <v-spacer />
      <v-btn
        prepend-icon="mdi-delete-outline"
        color="error"
        variant="text"
        size="small"
        @click="emit('deleteRequest', room.id)"
      >
        Delete room
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.room-panel {
  width: 100%;
}
.dims-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.dims-btn:hover {
  opacity: 0.75;
}
.fixture-editor {
  background: rgba(var(--v-theme-primary), 0.06);
  border-radius: 6px;
}
.opening-selected {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  border-radius: 4px;
}
</style>
