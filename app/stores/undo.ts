import { defineStore } from 'pinia'

// UX8 (forgiveness): low-stakes destructive actions execute immediately and
// offer a 6-second undo via the app-level snackbar (AppUndoSnackbar in the
// default layout). A new offer replaces the previous one — single-slot, like
// Gmail's undo. Confirm dialogs stay reserved for room/project deletion.
export const useUndoStore = defineStore('undo', () => {
  const visible = ref(false)
  const message = ref('')
  let undoFn: (() => Promise<void> | void) | null = null

  function offer(text: string, undo: () => Promise<void> | void) {
    message.value = text
    undoFn = undo
    // Retrigger the snackbar timeout even when one is already showing.
    visible.value = false
    nextTick(() => (visible.value = true))
  }

  async function performUndo() {
    const fn = undoFn
    undoFn = null
    visible.value = false
    if (fn) await fn()
  }

  function dismiss() {
    undoFn = null
    visible.value = false
  }

  return { visible, message, offer, performUndo, dismiss }
})
