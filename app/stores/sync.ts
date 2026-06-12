import { defineStore } from 'pinia'

// Tracks write/connectivity state for the UX9 surface: a subtle app-bar sync
// indicator while optimistic writes are in flight, and a persistent offline
// pill when disconnected. Writes call begin()/end() around their Firestore op;
// the indicator never becomes a blocking spinner.
export const useSyncStore = defineStore('sync', () => {
  const pending = ref(0)
  const isOnline = ref(true)

  const isSyncing = computed(() => pending.value > 0)

  function begin() {
    pending.value++
  }
  function end() {
    if (pending.value > 0) pending.value--
  }

  // Run an optimistic write, counting it for the sync indicator. The caller's
  // local state is updated optimistically by VueFire; this only tracks the
  // round-trip for the indicator and never blocks the UI.
  async function track<T>(op: () => Promise<T>): Promise<T> {
    begin()
    try {
      return await op()
    }
    finally {
      end()
    }
  }

  function setOnline(value: boolean) {
    isOnline.value = value
  }

  return { pending, isOnline, isSyncing, begin, end, track, setOnline }
})
