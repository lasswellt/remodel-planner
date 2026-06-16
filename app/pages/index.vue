<script setup lang="ts">
import type { Fixture, FixtureKind, Geometry, Notch, Opening, OpeningKind, Room, RoomType } from '~/models'
import type { DimDetail, FloorplanTool } from '~/composables/useFloorplan'
import FloorplanCanvas from '~/components/floorplan/FloorplanCanvas.vue'
import { clampFixtureToRoom, DEFAULT_GRID_STEP } from '~/utils/geometry'
import { buildFloorplanSvg, downloadPng, downloadSvg, slugify } from '~/utils/floorplan-export'
import { effectiveRoomStatus } from '~/utils/rollup'
import { useProjectStore } from '~/stores/project'
import { useRoomsStore } from '~/stores/rooms'

// Floorplan — the app's home screen and primary navigation (UX4). Drawing,
// dragging, and resizing happen on the canvas; this page owns persistence,
// dialogs, floors, and export.
const projectStore = useProjectStore()
const roomsStore = useRoomsStore()
const rollup = useRollup()
const { mdAndUp } = useDisplay()

const tool = ref<FloorplanTool>('select')
const gridStep = useLocalStorage('remodel.gridStep', DEFAULT_GRID_STEP)
const dimDetail = useLocalStorage<DimDetail>('remodel.dimDetail', 'medium')
const floor = ref(1)
const selectedId = ref<string | null>(null)
const selectedFixtureId = ref<string | null>(null)
const selectedOpeningId = ref<string | null>(null)
// Mobile only: the room editor (bottom sheet) opens on an explicit double-tap,
// not on plain selection — so moving rooms is never covered by the full sheet.
// Desktop keeps its side panel on selection (unaffected by this flag).
const panelOpen = ref(false)
const openingKind = ref<OpeningKind>('door')
const fixtureKind = ref<FixtureKind>('tub')
const canvas = ref<InstanceType<typeof FloorplanCanvas> | null>(null)

// Floors are a contiguous 1..top range so a gap floor (rooms on 1 and 3 only)
// stays reachable. addedTop keeps a freshly added, still-empty floor's tab
// alive across tab switches within the session.
const addedTop = ref(1)
const floors = computed(() => {
  const top = Math.max(1, addedTop.value, floor.value, ...roomsStore.rooms.map(r => r.floor))
  return Array.from({ length: top }, (_, i) => i + 1)
})
const floorRooms = computed(() => roomsStore.rooms.filter(r => r.floor === floor.value))
const selectedRoom = computed(
  () => floorRooms.value.find(r => r.id === selectedId.value) ?? null,
)

watch(floor, () => { selectedId.value = null; selectedFixtureId.value = null; selectedOpeningId.value = null })
// Exit notch mode when the selection is cleared
watch(selectedId, (id) => { if (!id && tool.value === 'notch') tool.value = 'select' })
watch(() => projectStore.currentProjectId, () => {
  selectedId.value = null
  selectedFixtureId.value = null
  selectedOpeningId.value = null
  panelOpen.value = false
  floor.value = 1
  addedTop.value = 1
})

// Double-tap a room (mobile) → select it and raise its editor sheet.
function onRequestEdit(id: string) {
  selectedId.value = id
  panelOpen.value = true
}

// --- create (draw → name + type dialog) ---
const createOpen = ref(false)
const pendingGeometry = ref<Geometry | null>(null)
const defaultName = computed(() => `Room ${roomsStore.rooms.length + 1}`)

function onCreate(geo: Geometry) {
  pendingGeometry.value = geo
  createOpen.value = true
}

function confirmCreate(data: { name: string, type: RoomType }) {
  const geometry = pendingGeometry.value
  pendingGeometry.value = null
  if (!geometry) return
  tool.value = 'select'
  selectedId.value = roomsStore.createRoom({
    ...data,
    floor: floor.value,
    geometry,
  })
}

// --- delete (room deletion is high-stakes → confirm, UX8) ---
const deleteTarget = ref<Room | null>(null)
const deleteError = ref(false)

function onDeleteRequest(id: string) {
  deleteTarget.value = roomsStore.roomById[id] ?? null
}

async function confirmDelete() {
  const target = deleteTarget.value
  deleteTarget.value = null
  if (!target) return
  if (selectedId.value === target.id) selectedId.value = null
  try {
    await roomsStore.removeRoom(target.id)
  }
  catch {
    // Cascade enumeration is server-sourced and fails fast offline rather
    // than orphaning uncached subdocs.
    deleteError.value = true
  }
}

// --- geometry writes ---
function onCommit(id: string, geometry: Geometry) {
  roomsStore.updateRoom(id, { geometry })
}

function onAddNotch(roomId: string, notch: Omit<Notch, 'id'>) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  const newNotch: Notch = { id: crypto.randomUUID(), ...notch }
  roomsStore.updateRoom(roomId, {
    geometry: { ...room.geometry, notches: [...room.geometry.notches, newNotch] },
  })
}

function onDeleteNotch(roomId: string, notchId: string) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  roomsStore.updateRoom(roomId, {
    geometry: { ...room.geometry, notches: room.geometry.notches.filter(n => n.id !== notchId) },
  })
}

// Dragging a room brings it strictly to the front so it bites overlaps. Compare
// against the OTHER rooms (not including this one) and bump on a tie too —
// otherwise a room tied for the top z loses the z-tiebreak to array order and
// gets bitten by the room it was dropped on. No-op when already the unique top.
function onBringToFront(id: string) {
  const room = roomsStore.roomById[id]
  if (!room) return
  const maxOther = Math.max(0, ...roomsStore.rooms.filter(r => r.id !== id).map(r => r.z ?? 0))
  if ((room.z ?? 0) <= maxOther) roomsStore.updateRoom(id, { z: maxOther + 1 })
}

// --- openings (doors / windows) ---
function onAddOpening(roomId: string, opening: Omit<Opening, 'id'>) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  const id = crypto.randomUUID()
  roomsStore.updateRoom(roomId, {
    geometry: { ...room.geometry, openings: [...(room.geometry.openings ?? []), { id, ...opening }] },
  })
  selectedOpeningId.value = id // select the just-placed opening for tweaking
}

function onCommitOpening(roomId: string, opening: Opening) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  roomsStore.updateRoom(roomId, {
    geometry: { ...room.geometry, openings: (room.geometry.openings ?? []).map(o => (o.id === opening.id ? opening : o)) },
  })
}

function onDeleteOpening(roomId: string, openingId: string) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  roomsStore.updateRoom(roomId, {
    geometry: { ...room.geometry, openings: (room.geometry.openings ?? []).filter(o => o.id !== openingId) },
  })
  if (selectedOpeningId.value === openingId) selectedOpeningId.value = null
}

// --- fixtures ---
function onAddFixture(roomId: string, fixture: Omit<Fixture, 'id'>) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  const id = crypto.randomUUID()
  roomsStore.updateRoom(roomId, {
    geometry: { ...room.geometry, fixtures: [...(room.geometry.fixtures ?? []), { id, ...fixture }] },
  })
  selectedFixtureId.value = id // select the freshly placed fixture for tweaking
}

function onCommitFixture(roomId: string, fixture: Fixture) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  roomsStore.updateRoom(roomId, {
    geometry: {
      ...room.geometry,
      fixtures: (room.geometry.fixtures ?? []).map(f => (f.id === fixture.id ? fixture : f)),
    },
  })
}

function onDeleteFixture(roomId: string, fixtureId: string) {
  const room = roomsStore.roomById[roomId]
  if (!room) return
  roomsStore.updateRoom(roomId, {
    geometry: { ...room.geometry, fixtures: (room.geometry.fixtures ?? []).filter(f => f.id !== fixtureId) },
  })
  if (selectedFixtureId.value === fixtureId) selectedFixtureId.value = null
}

// Panel edits to a fixture (size / rotation / label) re-clamp it into the room.
function onUpdateFixture(roomId: string, fixtureId: string, patch: Partial<Fixture>) {
  const room = roomsStore.roomById[roomId]
  const current = room?.geometry.fixtures?.find(f => f.id === fixtureId)
  if (!room || !current) return
  const merged = { ...current, ...patch }
  onCommitFixture(roomId, { ...merged, ...clampFixtureToRoom(room.geometry, merged) })
}

// The panel footer rotates the room (the fixture editor rotates a fixture);
// delegated to the canvas so it includes any in-flight overlay.
function onRotate() {
  canvas.value?.rotateRoom()
}

function addFloor() {
  addedTop.value = Math.max(...floors.value) + 1
  floor.value = addedTop.value
}

// --- export ---
async function onExport(kind: 'svg' | 'png') {
  const title = `${projectStore.currentProject?.name ?? 'Floorplan'} — Floor ${floor.value}`
  const progressByRoom = Object.fromEntries(
    floorRooms.value.map(r => [r.id, rollup.byRoom(r.id)]),
  )
  const svg = buildFloorplanSvg({
    rooms: floorRooms.value,
    gridStep: gridStep.value,
    title,
    progressByRoom,
    statusByRoom: Object.fromEntries(
      floorRooms.value.map(r => [r.id, effectiveRoomStatus(r.status, progressByRoom[r.id]!)]),
    ),
  })
  const base = `${slugify(projectStore.currentProject?.name ?? 'floorplan')}-floor-${floor.value}`
  if (kind === 'svg') downloadSvg(svg, `${base}.svg`)
  else await downloadPng(svg, `${base}.png`)
}

const projectCreateOpen = ref(false)
</script>

<template>
  <div>
    <!-- UX10: no project yet — the empty state is the onboarding. -->
    <v-empty-state
      v-if="!projectStore.currentProjectId"
    icon="mdi-home-plus-outline"
    title="Start your remodel"
    text="Create a project, then draw your rooms on the floorplan. Each room gets its own checklist, budget, and task board."
    class="mt-8"
  >
    <template #actions>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="projectCreateOpen = true">
        Create project
      </v-btn>

</template>
  </v-empty-state>

  <div v-else>
    <FloorplanToolbar
      v-model:tool="tool"
      v-model:grid-step="gridStep"
      v-model:floor="floor"
      v-model:opening-kind="openingKind"
      v-model:fixture-kind="fixtureKind"
      v-model:dim-detail="dimDetail"
      :floors="floors"
      :export-disabled="floorRooms.length === 0"
      :has-selection="!!selectedId"
      @add-floor="addFloor"
      @export="onExport"
    />

    <div class="d-flex ga-4 align-start">
      <div class="flex-grow-1 fp-canvas-col">
        <FloorplanCanvas
          ref="canvas"
          v-model:selected="selectedId"
          v-model:selected-fixture="selectedFixtureId"
          v-model:selected-opening="selectedOpeningId"
          v-model:tool="tool"
          :rooms="floorRooms"
          :grid-step="gridStep"
          :opening-kind="openingKind"
          :fixture-kind="fixtureKind"
          :dim-detail="dimDetail"
          @create="onCreate"
          @commit="onCommit"
          @delete-request="onDeleteRequest"
          @add-notch="onAddNotch"
          @bring-to-front="onBringToFront"
          @add-opening="onAddOpening"
          @commit-opening="onCommitOpening"
          @delete-opening="onDeleteOpening"
          @add-fixture="onAddFixture"
          @commit-fixture="onCommitFixture"
          @delete-fixture="onDeleteFixture"
          @request-edit="onRequestEdit"
          @pointer-start="panelOpen = false"
        />
      </div>
      <div v-if="selectedRoom && mdAndUp" class="fp-panel-col">
        <FloorplanRoomSummaryPanel
          :room="selectedRoom"
          :selected-fixture-id="selectedFixtureId"
          :selected-opening-id="selectedOpeningId"
          @close="selectedId = null"
          @delete-request="onDeleteRequest"
          @rotate="onRotate"
          @activate-notch-tool="tool = 'notch'"
          @delete-notch="onDeleteNotch"
          @update-fixture="onUpdateFixture"
          @delete-fixture="onDeleteFixture"
          @select-fixture="(id: string | null) => selectedFixtureId = id"
          @select-opening="(id: string | null) => selectedOpeningId = id"
        />
      </div>
    </div>

    <v-bottom-sheet
      v-if="!mdAndUp"
      :model-value="!!selectedRoom && panelOpen"
      inset
      @update:model-value="(v: boolean) => { if (!v) panelOpen = false }"
    >
      <FloorplanRoomSummaryPanel
        v-if="selectedRoom"
        :room="selectedRoom"
        :selected-fixture-id="selectedFixtureId"
        :selected-opening-id="selectedOpeningId"
        @close="panelOpen = false"
        @delete-request="onDeleteRequest"
        @rotate="onRotate"
        @activate-notch-tool="tool = 'notch'"
        @delete-notch="onDeleteNotch"
        @update-fixture="onUpdateFixture"
        @delete-fixture="onDeleteFixture"
        @select-fixture="(id: string | null) => selectedFixtureId = id"
        @select-opening="(id: string | null) => selectedOpeningId = id"
      />
    </v-bottom-sheet>

    <FloorplanRoomCreateDialog
      v-model="createOpen"
      :geometry="pendingGeometry"
      :default-name="defaultName"
      @confirm="confirmCreate"
      @cancel="pendingGeometry = null"
    />

    <v-dialog :model-value="!!deleteTarget" max-width="440" @update:model-value="deleteTarget = null">
      <v-card>
        <v-card-title>Delete “{{ deleteTarget?.name }}”?</v-card-title>
        <v-card-text>
          This removes the room and everything attached to it — checklist,
          budget lines, tasks, shopping &amp; selection items, and photo records. There is no undo.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteTarget = null">Cancel</v-btn>
          <v-btn color="error" @click="confirmDelete">Delete room</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="deleteError" color="error" timeout="6000">
      Couldn’t delete the room — you appear to be offline. Reconnect and try again.
    </v-snackbar>
  </div>

  <ProjectCreateDialog v-model="projectCreateOpen" />
</div></template>

<style scoped>
.fp-canvas-col {
  min-width: 0;
}
.fp-panel-col {
  width: 360px;
  flex-shrink: 0;
}
</style>
