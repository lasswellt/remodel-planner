<script setup lang="ts">
import { useCurrentUser } from 'vuefire'
import { useProjectStore } from '~/stores/project'

const projectStore = useProjectStore()
const user = useCurrentUser()

const createOpen = ref(false)
const renameOpen = ref(false)
const deleteOpen = ref(false)
const shareOpen = ref(false)
const renameValue = ref('')
const busy = ref(false)
const deleteError = ref(false)

const current = computed(() => projectStore.currentProject)
const isShared = computed(() => projectStore.isSharedProject)

function startRename() {
  renameValue.value = current.value?.name ?? ''
  renameOpen.value = true
}

async function applyRename() {
  const name = renameValue.value.trim()
  if (!name || !current.value) return
  renameOpen.value = false
  await projectStore.renameProject(current.value.id, name)
}

async function applyDelete() {
  if (!current.value || busy.value) return
  busy.value = true
  try {
    await projectStore.removeProject(current.value.id)
    deleteOpen.value = false
  }
  catch {
    deleteError.value = true
  }
  finally {
    busy.value = false
  }
}

async function leaveShared() {
  if (!current.value || busy.value) return
  busy.value = true
  try {
    await projectStore.leaveProject(current.value.uid, current.value.id)
    deleteOpen.value = false
  }
  catch {
    deleteError.value = true
  }
  finally {
    busy.value = false
  }
}

const hasAnyProject = computed(() => projectStore.allProjects.length > 0)
</script>

<template>
  <div class="d-flex align-center">
    <v-menu v-if="hasAnyProject" location="bottom start">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          variant="text"
          prepend-icon="mdi-home-city-outline"
          append-icon="mdi-chevron-down"
          class="text-none app-project-btn"
        >
          {{ current?.name ?? 'Select project' }}
          <v-icon
            v-if="isShared"
            icon="mdi-account-multiple-outline"
            size="14"
            class="ml-1 text-medium-emphasis"
          />
        </v-btn>
      </template>
      <v-list density="compact" min-width="240">
        <!-- Own projects -->
        <v-list-subheader v-if="projectStore.sharedRefs.length > 0">My projects</v-list-subheader>
        <v-list-item
          v-for="p in projectStore.projects"
          :key="p.id"
          :title="p.name"
          :append-icon="p.id === projectStore.currentProjectId && !isShared ? 'mdi-check' : undefined"
          @click="projectStore.selectProject(p.id, user?.uid)"
        />

        <!-- Shared projects -->
        <template v-if="projectStore.sharedRefs.length > 0">
          <v-divider />
          <v-list-subheader>Shared with me</v-list-subheader>
          <v-list-item
            v-for="r in projectStore.sharedRefs"
            :key="r.projectId"
            :append-icon="r.projectId === projectStore.currentProjectId && isShared ? 'mdi-check' : undefined"
            @click="projectStore.selectProject(r.projectId, r.ownerUid)"
          >
            <template #title>
              <span>{{ r.projectName }}</span>
              <v-icon icon="mdi-account-multiple-outline" size="14" class="ml-1 text-medium-emphasis" />
            </template>
          </v-list-item>
        </template>

        <v-divider />
        <v-list-item prepend-icon="mdi-plus" title="New project…" @click="createOpen = true" />
        <v-list-item
          prepend-icon="mdi-share-variant-outline"
          title="Share project…"
          :disabled="!current || isShared"
          @click="shareOpen = true"
        />
        <v-list-item
          prepend-icon="mdi-pencil-outline"
          title="Rename…"
          :disabled="!current || isShared"
          @click="startRename"
        />
        <v-list-item
          v-if="!isShared"
          prepend-icon="mdi-delete-outline"
          title="Delete project…"
          base-color="error"
          :disabled="!current"
          @click="deleteOpen = true"
        />
        <v-list-item
          v-else
          prepend-icon="mdi-exit-to-app"
          title="Leave shared project…"
          base-color="warning"
          @click="deleteOpen = true"
        />
      </v-list>
    </v-menu>
    <v-btn
      v-else
      variant="tonal"
      prepend-icon="mdi-plus"
      class="text-none"
      @click="createOpen = true"
    >
      Create project
    </v-btn>

    <ProjectCreateDialog v-model="createOpen" />
    <ShareProjectDialog v-model="shareOpen" />

    <v-dialog v-model="renameOpen" max-width="400">
      <v-card>
        <v-card-title>Rename project</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="applyRename">
            <v-text-field v-model="renameValue" label="Project name" autofocus />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="renameOpen = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!renameValue.trim()" @click="applyRename">Rename</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete own project -->
    <v-dialog v-if="!isShared" v-model="deleteOpen" max-width="440">
      <v-card>
        <v-card-title>Delete "{{ current?.name }}"?</v-card-title>
        <v-card-text>
          This permanently deletes the project and everything in it — rooms,
          checklists, budget lines, tasks, selections, permits, inspiration,
          and photo records. There is no undo.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteOpen = false">Cancel</v-btn>
          <v-btn color="error" :loading="busy" @click="applyDelete">Delete project</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Leave shared project -->
    <v-dialog v-else v-model="deleteOpen" max-width="440">
      <v-card>
        <v-card-title>Leave "{{ current?.name }}"?</v-card-title>
        <v-card-text>
          You'll lose access to this shared project. The owner's data is not affected.
          You can rejoin later if the owner sends you a new invite link.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteOpen = false">Cancel</v-btn>
          <v-btn color="warning" :loading="busy" @click="leaveShared">Leave project</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="deleteError" color="error" timeout="6000">
      Couldn't complete that action — you appear to be offline. Reconnect and try again.
    </v-snackbar>
  </div>
</template>

<style scoped>
.app-project-btn {
  max-width: 240px;
}
.app-project-btn :deep(.v-btn__content) {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
