import {
  collection,
  collectionGroup,
  doc,
  type Firestore,
} from 'firebase/firestore'
import {
  BudgetLine,
  ChecklistItem,
  InspirationItem,
  Permit,
  Photo,
  Project,
  Room,
  Selection,
  Task,
} from '~/models'
import { zodConverter } from '~/utils/converters'

// Firestore layout (everything scoped under the authenticated user):
//   users/{uid}/projects/{projectId}
//     /rooms/{roomId}/{checklist,budgetLines,tasks,selections,photos}
//     /permits/{permitId}
//     /inspiration/{itemId}
//
// Helpers return converter-bound refs so reads/writes are typed + validated.

export const projectsCol = (db: Firestore, uid: string) =>
  collection(db, 'users', uid, 'projects').withConverter(zodConverter(Project))

export const projectDoc = (db: Firestore, uid: string, projectId: string) =>
  doc(db, 'users', uid, 'projects', projectId).withConverter(zodConverter(Project))

const sub = (db: Firestore, uid: string, projectId: string, ...rest: string[]) =>
  collection(db, 'users', uid, 'projects', projectId, ...rest)

export const roomsCol = (db: Firestore, uid: string, projectId: string) =>
  sub(db, uid, projectId, 'rooms').withConverter(zodConverter(Room))

export const checklistCol = (db: Firestore, uid: string, projectId: string, roomId: string) =>
  sub(db, uid, projectId, 'rooms', roomId, 'checklist').withConverter(zodConverter(ChecklistItem))

export const budgetLinesCol = (db: Firestore, uid: string, projectId: string, roomId: string) =>
  sub(db, uid, projectId, 'rooms', roomId, 'budgetLines').withConverter(zodConverter(BudgetLine))

export const tasksCol = (db: Firestore, uid: string, projectId: string, roomId: string) =>
  sub(db, uid, projectId, 'rooms', roomId, 'tasks').withConverter(zodConverter(Task))

export const selectionsCol = (db: Firestore, uid: string, projectId: string, roomId: string) =>
  sub(db, uid, projectId, 'rooms', roomId, 'selections').withConverter(zodConverter(Selection))

export const photosCol = (db: Firestore, uid: string, projectId: string, roomId: string) =>
  sub(db, uid, projectId, 'rooms', roomId, 'photos').withConverter(zodConverter(Photo))

export const permitsCol = (db: Firestore, uid: string, projectId: string) =>
  sub(db, uid, projectId, 'permits').withConverter(zodConverter(Permit))

export const inspirationCol = (db: Firestore, uid: string, projectId: string) =>
  sub(db, uid, projectId, 'inspiration').withConverter(zodConverter(InspirationItem))

// Project-wide dashboards (all blocked tasks, overdue selections) use collection
// group queries; rules authorize them by the denormalized uid on each doc.
export const tasksGroup = (db: Firestore) =>
  collectionGroup(db, 'tasks').withConverter(zodConverter(Task))

export const selectionsGroup = (db: Firestore) =>
  collectionGroup(db, 'selections').withConverter(zodConverter(Selection))
