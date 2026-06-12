<script setup lang="ts">
import { useProjectStore } from '~/stores/project'

// Minimal project switcher in the app bar (Build Conventions): switch, create,
// rename, delete-with-confirm. Project deletion is the high-stakes case that
// earns a confirm dialog (UX8).
const projectStore = useProjectStore()

const createOpen = ref(false)
const renameOpen = ref(false)
const deleteOpen = ref(false)
const renameValue = ref('')
const busy = ref(false)
const deleteError = ref(false)

const current = computed(() => projectStore.currentProject)

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
    // Cascade enumeration is server-sourced and fails fast offline rather
    // than orphaning uncached subdocs.
    deleteError.value = true
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="d-flex align-center">
    <v-menu v-if="projectStore.projects.length > 0" location="bottom start">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          variant="text"
          prepend-icon="mdi-home-city-outline"
          append-icon="mdi-chevron-down"
          class="text-none app-project-btn"
        >
          {{ current?.name ?? 'Select project' }}
        </v-btn>
      </template>
      <v-list density="compact" min-width="240">
        <v-list-item
          v-for="p in projectStore.projects"
          :key="p.id"
          :title="p.name"
          :append-icon="p.id === projectStore.currentProjectId ? 'mdi-check' : undefined"
          @click="projectStore.selectProject(p.id)"
        />
        <v-divider />
        <v-list-item prepend-icon="mdi-plus" title="New project…" @click="createOpen = true" />
        <v-list-item
          prepend-icon="mdi-pencil-outline"
          title="Rename…"
          :disabled="!current"
          @click="startRename"
        />
        <v-list-item
          prepend-icon="mdi-delete-outline"
          title="Delete project…"
          base-color="error"
          :disabled="!current"
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

    <v-dialog v-model="deleteOpen" max-width="440">
      <v-card>
        <v-card-title>Delete “{{ current?.name }}”?</v-card-title>
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

    <v-snackbar v-model="deleteError" color="error" timeout="6000">
      Couldn’t delete the project — you appear to be offline. Reconnect and try again.
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
