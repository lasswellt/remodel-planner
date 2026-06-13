import type { UpdateData } from 'firebase/firestore'
import { doc, writeBatch } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import type { ChecklistItem, Room, Task } from '~/models'
import { ROOM_TEMPLATES } from '~/config/templates'
import { checklistCol, roomsCol, tasksCol } from '~/utils/firestore-paths'
import { useProjectStore } from '~/stores/project'
import { useSyncStore } from '~/stores/sync'

export interface TemplateApplyResult {
  items: number
  tasks: number
}

export function useTemplateApply() {
  const db = useFirestore()
  const projectStore = useProjectStore()
  const sync = useSyncStore()

  async function applyTemplate(room: Room): Promise<TemplateApplyResult> {
    const uid = projectStore.activeOwnerUid
    if (!uid) throw new Error('applyTemplate: no active project')
    const template = ROOM_TEMPLATES[room.type]
    const base = { uid, projectId: room.projectId, roomId: room.id }

    const cCol = checklistCol(db, uid, room.projectId, room.id)
    const tCol = tasksCol(db, uid, room.projectId, room.id)
    const batch = writeBatch(db)

    for (const item of template.checklist) {
      const ref = doc(cCol)
      const data: ChecklistItem = {
        id: ref.id,
        ...base,
        label: item.label,
        category: item.category,
        done: false,
        fromTemplate: true,
        ...(item.psychologyTag ? { psychologyTag: item.psychologyTag } : {}),
      }
      batch.set(ref, data)
    }

    const idByKey = new Map(template.tasks.map(t => [t.key, doc(tCol).id]))
    for (const task of template.tasks) {
      const data: Task = {
        id: idByKey.get(task.key)!,
        ...base,
        label: task.label,
        phase: task.phase,
        status: 'todo',
        dependsOn: (task.dependsOn ?? []).map(key => idByKey.get(key)!),
        blockedBySelections: [],
      }
      batch.set(doc(tCol, data.id), data)
    }

    if (room.status === 'planned') {
      batch.update(
        doc(roomsCol(db, uid, room.projectId), room.id),
        { status: 'in-progress' } as UpdateData<Room>,
      )
    }

    await sync.track(() => batch.commit())
    return { items: template.checklist.length, tasks: template.tasks.length }
  }

  return { applyTemplate }
}
