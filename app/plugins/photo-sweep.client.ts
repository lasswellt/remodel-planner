import { useCurrentUser, useFirebaseStorage, useFirestore } from 'vuefire'
import { sweepSoftDeletes } from '~/composables/usePhotos'
import { useProjectStore } from '~/stores/project'

// Build Conventions: a client sweep on app start purges photo soft-deletes
// older than 24h (no Cloud Functions own the cleanup). Runs once per
// (owner, project) once auth and a project have settled. Owner-only — Storage
// is owner-scoped, so a member cannot delete the objects.
export default defineNuxtPlugin(() => {
  const db = useFirestore()
  const storage = useFirebaseStorage()
  const user = useCurrentUser()
  const projectStore = useProjectStore()
  const swept = new Set<string>()

  watch(
    () => [user.value?.uid, projectStore.currentProjectId, projectStore.activeOwnerUid] as const,
    async ([uid, projectId, ownerUid]) => {
      if (!uid || !projectId || ownerUid !== uid) return
      const key = `${uid}:${projectId}`
      if (swept.has(key)) return
      swept.add(key)
      try {
        await sweepSoftDeletes(db, storage, uid, projectId)
      }
      catch {
        // Offline or transient — the next app start retries the sweep.
      }
    },
    { immediate: true },
  )
})
