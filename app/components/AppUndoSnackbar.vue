<script setup lang="ts">
import { useUndoStore } from '~/stores/undo'

// App-level undo snackbar (UX8). Lives in the default layout so checklist
// items, budget lines, and tasks all share the same forgiveness surface.
const undo = useUndoStore()
</script>

<template>
  <v-snackbar
    :model-value="undo.visible"
    timeout="6000"
    @update:model-value="(v: boolean) => { if (!v) undo.dismiss() }"
  >
    {{ undo.message }}
    <template #actions>
      <v-btn color="primary" variant="text" @click="undo.performUndo()">
        Undo
      </v-btn>
    </template>
  </v-snackbar>
</template>
