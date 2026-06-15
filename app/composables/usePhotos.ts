import {
  deleteDoc,
  deleteField,
  doc,
  getDocsFromServer,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Firestore, UpdateData } from 'firebase/firestore'
import { deleteObject, ref as storageRef, uploadBytesResumable } from 'firebase/storage'
import type { FirebaseStorage, StorageReference } from 'firebase/storage'
import { useFirebaseStorage, useCollection, useFirestore } from 'vuefire'
import type { Photo, PhotoStage, Room } from '~/models'
import { PHOTO_STAGES } from '~/config/photos'
import { photosCol, photosGroup } from '~/utils/firestore-paths'
import { photoOriginalPath, photoThumbPath } from '~/utils/storage-paths'
import { backoffDelay, downscaleToBlob } from '~/utils/image-downscale'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'
import { useUndoStore } from '~/stores/undo'

const MAX_ORIGINAL_EDGE = 2000
const THUMB_EDGE = 400
const MAX_RETRIES = 3
const SOFT_DELETE_TTL_MS = 24 * 60 * 60 * 1000

// Per-room photos, excluding soft-deleted (which linger until the 24h sweep).
export function useRoomPhotos(roomId: () => string) {
  const db = useFirestore()
  const projectStore = useProjectStore()

  const source = computed(() =>
    projectStore.activeOwnerUid && projectStore.currentProjectId && roomId()
      ? photosCol(db, projectStore.activeOwnerUid, projectStore.currentProjectId, roomId())
      : null,
  )
  const all = useCollection<Photo>(source, { ssrKey: 'room-photos' })
  const photos = computed(() => all.value.filter(p => !p.deletedAt))
  // Group by stage once per data change so byStage() is an O(1) lookup with a
  // stable array identity — the gallery template calls it per stage in both a
  // v-if length check and a v-for (was a full filter scan on each call).
  const byStageMap = computed(() => {
    const m = new Map<PhotoStage, Photo[]>(PHOTO_STAGES.map(s => [s, [] as Photo[]]))
    for (const p of photos.value) m.get(p.stage)?.push(p)
    return m
  })
  const byStage = (stage: PhotoStage) => byStageMap.value.get(stage) ?? []

  return { photos, byStage }
}

export interface UploadItem {
  id: string
  fileName: string
  stage: PhotoStage
  caption?: string
  roomId: string
  file: File
  progress: number
  status: 'uploading' | 'error' | 'done'
  error?: string
}

function uploadWithProgress(
  ref: StorageReference,
  blob: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref, blob, { contentType: 'image/jpeg' })
    task.on(
      'state_changed',
      snap => onProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(),
    )
  })
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// Optimistic, retrying photo upload (UX9). The local File is held on the item
// until success, so a failure never loses it silently — it shows a Retry.
export function usePhotoUpload() {
  const db = useFirestore()
  const storage = useFirebaseStorage()
  const projectStore = useProjectStore()

  const uploads = ref<UploadItem[]>([])

  async function runOnce(item: UploadItem): Promise<void> {
    item.status = 'uploading'
    item.error = undefined
    item.progress = 0
    const ownerUid = projectStore.activeOwnerUid
    const projectId = projectStore.currentProjectId
    if (!ownerUid || !projectId) throw new Error('No active project')

    const [original, thumb] = await Promise.all([
      downscaleToBlob(item.file, MAX_ORIGINAL_EDGE),
      downscaleToBlob(item.file, THUMB_EDGE),
    ])
    const origPath = photoOriginalPath(ownerUid, projectId, item.roomId, item.id)
    const thumbPath = photoThumbPath(ownerUid, projectId, item.roomId, item.id)

    await uploadWithProgress(storageRef(storage, origPath), original, f => (item.progress = f * 0.85))
    await uploadWithProgress(storageRef(storage, thumbPath), thumb, f => (item.progress = 0.85 + f * 0.1))

    const photo: Photo = {
      id: item.id,
      uid: ownerUid,
      projectId,
      roomId: item.roomId,
      storagePath: origPath,
      thumbPath,
      stage: item.stage,
      takenAt: Timestamp.now(),
      ...(item.caption ? { caption: item.caption } : {}),
    }
    await setDoc(doc(photosCol(db, ownerUid, projectId, item.roomId), item.id), photo)
    item.progress = 1
    item.status = 'done'
    // Clear the completed chip after a beat.
    setTimeout(() => {
      uploads.value = uploads.value.filter(u => u.id !== item.id)
    }, 1500)
  }

  async function attempt(item: UploadItem): Promise<void> {
    for (let n = 0; n <= MAX_RETRIES; n++) {
      try {
        await runOnce(item)
        return
      }
      catch (e) {
        item.status = 'error'
        item.error = (e as Error).message
        if (n < MAX_RETRIES) await sleep(backoffDelay(n))
      }
    }
  }

  function start(room: Room, file: File, stage: PhotoStage, caption?: string): void {
    const item = reactive<UploadItem>({
      id: crypto.randomUUID(),
      fileName: file.name,
      stage,
      caption,
      roomId: room.id,
      file,
      progress: 0,
      status: 'uploading',
    })
    uploads.value.push(item)
    void attempt(item)
  }

  function retry(item: UploadItem): void {
    void attempt(item)
  }
  function dismiss(item: UploadItem): void {
    uploads.value = uploads.value.filter(u => u.id !== item.id)
  }

  return { uploads, start, retry, dismiss }
}

export function usePhotoOps() {
  const db = useFirestore()
  const storage = useFirebaseStorage()
  const sync = useSyncStore()
  const undo = useUndoStore()

  const docRef = (p: Photo) => doc(photosCol(db, p.uid, p.projectId, p.roomId), p.id)

  // Full-doc replace so cleared optional fields (caption, task/selection link)
  // are actually removed.
  function save(photo: Photo): void {
    void sync.track(() => setDoc(docRef(photo), photo))
  }

  // Soft delete (UX8): hide immediately, offer undo; the 24h sweep does the
  // real Storage + Firestore cleanup.
  function softDelete(p: Photo): void {
    void sync.track(() => updateDoc(docRef(p), { deletedAt: Timestamp.now() } as UpdateData<Photo>))
    undo.offer('Deleted photo', () =>
      sync.track(() => updateDoc(docRef(p), { deletedAt: deleteField() } as UpdateData<Photo>)),
    )
  }

  async function hardDelete(p: Photo): Promise<void> {
    await Promise.allSettled([
      deleteObject(storageRef(storage, p.storagePath)),
      deleteObject(storageRef(storage, p.thumbPath)),
    ])
    await deleteDoc(docRef(p))
  }

  return { save, softDelete, hardDelete }
}

// Client-side sweep (Build Conventions: no Cloud Functions). Purges photos
// soft-deleted more than 24h ago — Storage objects then the Firestore doc.
// getDocsFromServer so a stale offline cache can't hide pending purges.
export async function sweepSoftDeletes(
  db: Firestore,
  storage: FirebaseStorage,
  ownerUid: string,
  projectId: string,
): Promise<number> {
  // Query only the actually-expired soft-deletes. deletedAt is unset on live
  // photos, so a range filter returns exactly the purge set — instead of reading
  // every photo in the project on each sweep. Needs the (uid, projectId,
  // deletedAt) collection-group index.
  const cutoff = Timestamp.fromMillis(Date.now() - SOFT_DELETE_TTL_MS)
  const snap = await getDocsFromServer(
    query(
      photosGroup(db),
      where('uid', '==', ownerUid),
      where('projectId', '==', projectId),
      where('deletedAt', '<=', cutoff),
    ),
  )
  let purged = 0
  for (const d of snap.docs) {
    const p = d.data()
    await Promise.allSettled([
      deleteObject(storageRef(storage, p.storagePath)),
      deleteObject(storageRef(storage, p.thumbPath)),
    ])
    await deleteDoc(d.ref)
    purged++
  }
  return purged
}
