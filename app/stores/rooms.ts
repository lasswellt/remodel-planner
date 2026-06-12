import { defineStore } from 'pinia'
import { useCollection, useCurrentUser, useFirestore } from 'vuefire'
import { roomsCol } from '~/utils/firestore-paths'
import { useProjectStore } from '~/stores/project'

// Domain store for the current project's rooms, backed by a VueFire reactive
// binding that rebinds whenever the selected project changes.
export const useRoomsStore = defineStore('rooms', () => {
  const db = useFirestore()
  const user = useCurrentUser()
  const projectStore = useProjectStore()

  const source = computed(() =>
    user.value && projectStore.currentProjectId
      ? roomsCol(db, user.value.uid, projectStore.currentProjectId)
      : null,
  )
  const rooms = useCollection(source, { ssrKey: 'rooms' })

  const roomById = computed(() =>
    Object.fromEntries(rooms.value.map(r => [r.id, r])),
  )

  return { rooms, roomById }
})
