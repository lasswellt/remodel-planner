import { defineStore } from 'pinia'
import type { UpdateData } from 'firebase/firestore'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
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
  z: number
}>

export const useRoomsStore = defineStore('rooms', () => {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId
      ? roomsCol(db, projectStore.activeOwnerUid, projectStore.currentProjectId)
      : null,
  )
  const rooms = useCollection(source, { ssrKey: 'rooms' })

  const roomById = computed(() =>
    Object.fromEntries(rooms.value.map(r => [r.id, r])),
  )

  function scope() {
    if (!projectStore.activeOwnerUid || !projectStore.currentProjectId) {
      throw new Error('rooms store: no active project')
    }
    return { uid: projectStore.activeOwnerUid, projectId: projectStore.currentProjectId }
  }

  function createRoom(input: RoomCreate): string {
    const { uid, projectId } = scope()
    const col = roomsCol(db, uid, projectId)
    const id = doc(col).id
    // New rooms stack on top so they bite overlaps rather than being bitten.
    const maxZ = Math.max(0, ...rooms.value.map(r => r.z ?? 0))
    const room: Room = { id, uid, projectId, status: 'planned', z: maxZ + 1, ...input }
    void sync.track(() => setDoc(doc(col, id), room))
    return id
  }

  async function updateRoom(id: string, patch: RoomPatch): Promise<void> {
    const { uid, projectId } = scope()
    const ref = doc(roomsCol(db, uid, projectId), id)
    await sync.track(() => updateDoc(ref, patch as UpdateData<Room>))
  }

  async function removeRoom(id: string): Promise<void> {
    const { uid, projectId } = scope()
    const ref = doc(roomsCol(db, uid, projectId), id)
    await sync.track(() => deleteRoomDeep(db, uid, projectId, id, ref))
  }

  return { rooms, roomById, createRoom, updateRoom, removeRoom }
})
