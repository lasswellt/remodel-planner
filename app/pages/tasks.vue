<script setup lang="ts">
import type { TaskPhase } from '~/models'
import { TASK_PHASE_ORDER } from '~/models'
import { TASK_PHASE_LABELS } from '~/config/tasks'
import { useProjectTasks } from '~/composables/useTasks'
import { useProjectStore } from '~/stores/project'
import { useRoomsStore } from '~/stores/rooms'

// Phase 7 task board. Tasks are grouped by status (drag/menu to move), gated by
// dependency/selection/inspection (UX6), with project rollups by phase and by
// room from the one rollup source (UX1) and one-time completion moments (UX3).
const projectStore = useProjectStore()
const roomsStore = useRoomsStore()
const rollup = useRollup()
const tasksApi = useProjectTasks()

const rooms = computed(() =>
  [...roomsStore.rooms].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name)),
)

const roomFilter = ref('all')
const roomFilterItems = computed(() => [
  { value: 'all', title: 'All rooms' },
  ...rooms.value.map(r => ({ value: r.id, title: r.name })),
])

const visibleTasks = computed(() =>
  roomFilter.value === 'all'
    ? tasksApi.tasks.value
    : tasksApi.tasks.value.filter(t => t.roomId === roomFilter.value),
)
const hasTasks = computed(() => tasksApi.tasks.value.length > 0)

const roomProgress = computed(() =>
  rooms.value.map(room => ({ room, p: rollup.byRoom(room.id) })).filter(x => x.p.total > 0),
)

const addOpen = ref(false)

// UX3: one-time toast when a phase crosses to 100% across all rooms. Seed the
// "seen" set on first run so already-complete phases don't toast on load.
const completionMsg = ref('')
const seen = ref<Set<TaskPhase> | null>(null)
watch(
  () => rollup.byPhase.value,
  (bp) => {
    const now = new Set<TaskPhase>()
    for (const p of TASK_PHASE_ORDER) if (bp[p].complete) now.add(p)
    if (seen.value === null) {
      seen.value = now
      return
    }
    for (const p of now) {
      if (!seen.value.has(p)) completionMsg.value = `${TASK_PHASE_LABELS[p]} complete across all rooms 🎉`
    }
    seen.value = now
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div>
    <v-empty-state
      v-if="!projectStore.currentProjectId || rooms.length === 0"
      icon="mdi-clipboard-check-outline"
      title="No tasks yet"
      text="Tasks are seeded when you apply a room-type template. Draw a room on the floorplan, apply its template, then sequence the work here."
      class="mt-8"
    >
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-floor-plan" to="/">Open the floorplan</v-btn>
      </template>
    </v-empty-state>

    <template v-else>
      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <v-select
          v-model="roomFilter"
          :items="roomFilterItems"
          label="Room"
          density="compact"
          hide-details
          style="max-width: 220px"
        />
        <v-spacer />
        <v-btn color="primary" prepend-icon="mdi-plus" @click="addOpen = true">Add task</v-btn>
      </div>

      <v-row class="mb-2">
        <v-col cols="12" md="6">
          <v-card variant="flat" border class="h-100">
            <v-card-title class="text-body-1">By phase</v-card-title>
            <v-card-text>
              <TasksPhaseProgressBars :by-phase="rollup.byPhase.value" />
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card variant="flat" border class="h-100">
            <v-card-title class="text-body-1">By room</v-card-title>
            <v-card-text>
              <div v-if="roomProgress.length > 0">
                <div v-for="rp in roomProgress" :key="rp.room.id" class="mb-2">
                  <div class="d-flex justify-space-between text-body-2">
                    <span>{{ rp.room.name }}</span>
                    <span class="text-medium-emphasis">{{ rp.p.pct }}%</span>
                  </div>
                  <v-progress-linear
                    :model-value="rp.p.pct"
                    :color="rp.p.complete ? 'success' : 'primary'"
                    height="6"
                    rounded
                  />
                </div>
              </div>
              <p v-else class="text-body-2 text-medium-emphasis ma-0">No tasks yet.</p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <TasksTaskBoard
        v-if="hasTasks"
        :tasks="visibleTasks"
        :show-room="roomFilter === 'all'"
      />
      <v-empty-state
        v-else
        icon="mdi-clipboard-text-outline"
        title="No tasks on this project"
        text="Apply a room-type template from a room to seed phase-ordered tasks, or add one manually."
      >
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-view-grid-outline" to="/rooms">Open rooms</v-btn>
        </template>
      </v-empty-state>

      <TasksAddTaskDialog
        v-model="addOpen"
        :rooms="rooms"
        :default-room-id="roomFilter === 'all' ? undefined : roomFilter"
      />

      <v-snackbar
        :model-value="!!completionMsg"
        timeout="5000"
        color="success"
        @update:model-value="(v: boolean) => { if (!v) completionMsg = '' }"
      >
        {{ completionMsg }}
      </v-snackbar>
    </template>
  </div>
</template>
