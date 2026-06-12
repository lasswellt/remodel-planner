<script setup lang="ts">
import { useCollection, useCurrentUser, useFirestore } from 'vuefire'
import type { Room, RoomStatus, RoomType } from '~/models'
import { ROOM_TYPE_ICONS, ROOM_TYPE_OPTIONS } from '~/config/rooms'
import { sqFt } from '~/utils/geometry'
import { budgetLinesCol } from '~/utils/firestore-paths'
import { formatMoney } from '~/utils/money'
import { useRoomsStore } from '~/stores/rooms'

// Click-a-room summary (UX5): progress, budget remaining, next task at a
// glance, with expansion panels for the full lists. Deeper editing lives on
// the dedicated pages in later phases.
const props = defineProps<{ room: Room }>()
const emit = defineEmits<{
  close: []
  deleteRequest: [id: string]
  rotate: [id: string]
}>()

const db = useFirestore()
const user = useCurrentUser()
const roomsStore = useRoomsStore()
const rollup = useRollup()

const progress = computed(() => rollup.byRoom(props.room.id))
const nextTask = computed(() => rollup.nextTask(props.room.id))
const roomTasks = computed(() =>
  rollup.tasks.value.filter(t => t.roomId === props.room.id),
)

const linesSource = computed(() =>
  user.value
    ? budgetLinesCol(db, user.value.uid, props.room.projectId, props.room.id)
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
      <v-card-subtitle>{{ sqFt(room.geometry) }} sq ft · floor {{ room.floor }}</v-card-subtitle>
      <template #append>
        <v-btn icon="mdi-close" size="small" variant="text" aria-label="Close panel" @click="emit('close')" />
      </template>
    </v-card-item>

    <v-card-text class="pt-0">
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
</style>
