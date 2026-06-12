import type { DocumentReference, Firestore, Query } from 'firebase/firestore'
import { getDocsFromServer, writeBatch } from 'firebase/firestore'
import {
  budgetLinesCol,
  checklistCol,
  inspirationCol,
  permitsCol,
  photosCol,
  projectDoc,
  roomsCol,
  selectionsCol,
  tasksCol,
} from '~/utils/firestore-paths'

// Firestore has no server-side cascade and this app has no Cloud Functions, so
// the client owns subtree deletes. Orphaned subdocs would not just waste space:
// they still match the rollup's collection-group queries (uid + projectId), so
// a deleted room's tasks would keep counting toward progress.
//
// Enumeration MUST come from the server (getDocsFromServer): with offline
// persistence on, plain getDocs would silently resolve from the local cache —
// empty for any subcollection never bound by a listener — and an offline
// delete would orphan every uncached subdoc forever. Failing fast offline is
// the correct behavior; callers catch and tell the user to reconnect.
//
// Storage objects for photos are Phase 10's concern (photo delete handles its
// own object cleanup); this only removes Firestore documents.

const BATCH_LIMIT = 450 // headroom under Firestore's 500-op batch cap

async function deleteRefs(db: Firestore, refs: DocumentReference<unknown>[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref)
    await batch.commit()
  }
}

async function collectRefs(
  ...queries: Query<unknown>[]
): Promise<DocumentReference<unknown>[]> {
  const snaps = await Promise.all(queries.map(q => getDocsFromServer(q)))
  return snaps.flatMap(s => s.docs.map(d => d.ref))
}

export async function deleteRoomDeep(
  db: Firestore,
  uid: string,
  projectId: string,
  roomId: string,
  roomRef: DocumentReference<unknown>,
): Promise<void> {
  const refs = await collectRefs(
    checklistCol(db, uid, projectId, roomId),
    budgetLinesCol(db, uid, projectId, roomId),
    tasksCol(db, uid, projectId, roomId),
    selectionsCol(db, uid, projectId, roomId),
    photosCol(db, uid, projectId, roomId),
  )
  await deleteRefs(db, [...refs, roomRef])
}

export async function deleteProjectDeep(
  db: Firestore,
  uid: string,
  projectId: string,
): Promise<void> {
  const roomSnap = await getDocsFromServer(roomsCol(db, uid, projectId))
  for (const room of roomSnap.docs) {
    await deleteRoomDeep(db, uid, projectId, room.id, room.ref)
  }
  const rest = await collectRefs(
    permitsCol(db, uid, projectId),
    inspirationCol(db, uid, projectId),
  )
  await deleteRefs(db, [...rest, projectDoc(db, uid, projectId)])
}
