import { defineStore } from 'pinia'
import { useCollection, useCurrentUser, useDocument, useFirestore } from 'vuefire'
import { projectDoc, projectsCol } from '~/utils/firestore-paths'

// Domain store for projects, backed by VueFire reactive bindings. The data
// model is multi-project; the app bar switches between them. currentProjectId
// persists across reloads.
export const useProjectStore = defineStore('project', () => {
  const db = useFirestore()
  const user = useCurrentUser()

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

  // Default the selection to the first project once the list loads.
  watch(projects, (list) => {
    if (!currentProjectId.value && list.length > 0) {
      currentProjectId.value = list[0]!.id
    }
  })

  function selectProject(id: string) {
    currentProjectId.value = id
  }

  return { projects, currentProject, currentProjectId, selectProject }
})
