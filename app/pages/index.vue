<script setup lang="ts">
import type { Geometry, Notch, Room, RoomType } from '~/models'
import type { FloorplanTool } from '~/composables/useFloorplan'
import FloorplanCanvas from '~/components/floorplan/FloorplanCanvas.vue'
import { DEFAULT_GRID_STEP } from '~/utils/geometry'
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
const floor = ref(1)
const selectedId = ref<string | null>(null)
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

watch(floor, () => (selectedId.value = null))
// Exit notch mode when the selection is cleared
watch(selectedId, (id) => { if (!id && tool.value === 'notch') tool.value = 'select' })
watch(() => projectStore.currentProjectId, () => {
  selectedId.value = null
  floor.value = 1
  addedTop.value = 1
})

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

// Delegated to the canvas so the rotation includes any in-flight nudge overlay.
function onRotate() {
  canvas.value?.rotateSelected()
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
          v-model:tool="tool"
          :rooms="floorRooms"
          :grid-step="gridStep"
          @create="onCreate"
          @commit="onCommit"
          @delete-request="onDeleteRequest"
          @add-notch="onAddNotch"
        />
      </div>
      <div v-if="selectedRoom && mdAndUp" class="fp-panel-col">
        <FloorplanRoomSummaryPanel
          :room="selectedRoom"
          @close="selectedId = null"
          @delete-request="onDeleteRequest"
          @rotate="onRotate"
          @activate-notch-tool="tool = 'notch'"
          @delete-notch="onDeleteNotch"
        />
      </div>
    </div>

    <v-bottom-sheet
      v-if="!mdAndUp"
      :model-value="!!selectedRoom"
      inset
      @update:model-value="(v: boolean) => { if (!v) selectedId = null }"
    >
      <FloorplanRoomSummaryPanel
        v-if="selectedRoom"
        :room="selectedRoom"
        @close="selectedId = null"
        @delete-request="onDeleteRequest"
        @rotate="onRotate"
        @activate-notch-tool="tool = 'notch'"
        @delete-notch="onDeleteNotch"
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
          budget lines, tasks, selections, and photo records. There is no undo.
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
