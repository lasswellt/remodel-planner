import { defineStore } from 'pinia'
import type { UpdateData } from 'firebase/firestore'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { useCollection, useCurrentUser, useFirestore } from 'vuefire'
import type { Geometry, Room, RoomStatus, RoomType } from '~/models'
import { deleteRoomDeep } from '~/utils/firestore-cascade'
import { roomsCol } from '~/utils/firestore-paths'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'

export interface RoomCreate {
  name: string
  type: RoomType
  floor: number
  geometry: Geometry
}

export type RoomPatch = Partial<{
  name: string
  type: RoomType
  status: RoomStatus
  floor: number
  geometry: Geometry
}>

// Domain store for the current project's rooms, backed by a VueFire reactive
// binding that rebinds whenever the selected project changes. Writes are
// optimistic and tracked for the UX9 sync indicator.
export const useRoomsStore = defineStore('rooms', () => {
  const db = useFirestore()
  const user = useCurrentUser()
  const projectStore = useProjectStore()
  const sync = useSyncStore()

  const source = computed(() =>
    user.value && projectStore.currentProjectId
      ? roomsCol(db, user.value.uid, projectStore.currentProjectId)
      : null,
  )
  const rooms = useCollection(source, { ssrKey: 'rooms' })

  const roomById = computed(() =>
    Object.fromEntries(rooms.value.map(r => [r.id, r])),
  )

  function scope() {
    if (!user.value || !projectStore.currentProjectId) {
      throw new Error('rooms store: no signed-in user or selected project')
    }
    return { uid: user.value.uid, projectId: projectStore.currentProjectId }
  }

  // Optimistic (UX9): the room appears immediately from the local cache; the
  // sync indicator tracks the server round-trip.
  function createRoom(input: RoomCreate): string {
    const { uid, projectId } = scope()
    const col = roomsCol(db, uid, projectId)
    const id = doc(col).id
    const room: Room = { id, uid, projectId, status: 'planned', ...input }
    void sync.track(() => setDoc(doc(col, id), room))
    return id
  }

  async function updateRoom(id: string, patch: RoomPatch): Promise<void> {
    const { uid, projectId } = scope()
    const ref = doc(roomsCol(db, uid, projectId), id)
    await sync.track(() => updateDoc(ref, patch as UpdateData<Room>))
  }

  // Cascades through the room's subcollections (no Cloud Functions — the
  // client owns deletes). High-stakes: callers confirm first (UX8).
  async function removeRoom(id: string): Promise<void> {
    const { uid, projectId } = scope()
    const ref = doc(roomsCol(db, uid, projectId), id)
    await sync.track(() => deleteRoomDeep(db, uid, projectId, id, ref))
  }

  return { rooms, roomById, createRoom, updateRoom, removeRoom }
})
