import { defineStore } from 'pinia'
import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { useCollection, useCurrentUser, useDocument, useFirestore } from 'vuefire'
import type { Project } from '~/models'
import { deleteProjectDeep } from '~/utils/firestore-cascade'
import { projectDoc, projectsCol } from '~/utils/firestore-paths'
import { useSyncStore } from '~/stores/sync'

// Domain store for projects, backed by VueFire reactive bindings. The data
// model is multi-project; the app bar switches between them. currentProjectId
// persists across reloads.
export const useProjectStore = defineStore('project', () => {
  const db = useFirestore()
  const user = useCurrentUser()
  const sync = useSyncStore()

  const currentProjectId = useLocalStorage<string | null>('remodel.currentProjectId', null)

  const projectsSource = computed(() =>
    user.value ? projectsCol(db, user.value.uid) : null,
  )
  const projects = useCollection(projectsSource, { ssrKey: 'projects' })

  const currentSource = computed(() =>
    user.value && currentProjectId.value
      ? projectDoc(db, user.value.uid, currentProjectId.value)
      : null,
  )
  const currentProject = useDocument(currentSource, { ssrKey: 'currentProject' })

  // Reconcile the persisted selection against reality: default to the first
  // project, and drop a stale id (different user on this browser, or a project
  // deleted elsewhere) so the app never binds a ghost project (rooms drawn
  // under it would be orphaned data with no way back).
  watch(projects, (list) => {
    const id = currentProjectId.value
    if (id && !list.some(p => p.id === id)) {
      currentProjectId.value = list[0]?.id ?? null
    }
    else if (!id && list.length > 0) {
      currentProjectId.value = list[0]!.id
    }
  })

  function selectProject(id: string) {
    currentProjectId.value = id
  }

  function uid(): string {
    if (!user.value) throw new Error('project store: no signed-in user')
    return user.value.uid
  }

  // Optimistic (UX9): the local cache applies the write immediately and the
  // sync indicator tracks the server round-trip — callers never block on ack.
  function createProject(
    name: string,
    totalBudgetCents: number,
    address?: string,
  ): string {
    const col = projectsCol(db, uid())
    const id = doc(col).id
    const project: Project = {
      id,
      uid: uid(),
      name,
      ...(address ? { address } : {}),
      totalBudgetCents,
      contingencyPct: 15,
      createdAt: Timestamp.now(),
    }
    void sync.track(() => setDoc(doc(col, id), project))
    currentProjectId.value = id
    return id
  }

  async function renameProject(id: string, name: string): Promise<void> {
    await sync.track(() => updateDoc(projectDoc(db, uid(), id), { name }))
  }

  // Cascades through rooms (and their subcollections), permits, and
  // inspiration. High-stakes: callers confirm first (UX8).
  async function removeProject(id: string): Promise<void> {
    const owner = uid()
    await sync.track(() => deleteProjectDeep(db, owner, id))
    if (currentProjectId.value === id) {
      currentProjectId.value = projects.value.find(p => p.id !== id)?.id ?? null
    }
  }

  return {
    projects,
    currentProject,
    currentProjectId,
    selectProject,
    createProject,
    renameProject,
    removeProject,
  }
})
