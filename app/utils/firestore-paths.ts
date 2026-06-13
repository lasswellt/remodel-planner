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
  Member,
  Permit,
  Photo,
  Project,
  Room,
  Selection,
  SharedProjectRef,
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

// Project-wide dashboards (all blocked tasks, overdue selections) and the
// rollup (all tasks + checklist items of the current project) use collection
// group queries; rules authorize them by the denormalized uid on each doc.
export const tasksGroup = (db: Firestore) =>
  collectionGroup(db, 'tasks').withConverter(zodConverter(Task))

export const selectionsGroup = (db: Firestore) =>
  collectionGroup(db, 'selections').withConverter(zodConverter(Selection))

export const checklistGroup = (db: Firestore) =>
  collectionGroup(db, 'checklist').withConverter(zodConverter(ChecklistItem))

export const budgetLinesGroup = (db: Firestore) =>
  collectionGroup(db, 'budgetLines').withConverter(zodConverter(BudgetLine))

// Sharing: members subcollection, invites root, shared-project pointers
export const membersCol = (db: Firestore, ownerUid: string, projectId: string) =>
  collection(db, 'users', ownerUid, 'projects', projectId, 'members').withConverter(zodConverter(Member))

export const memberDoc = (db: Firestore, ownerUid: string, projectId: string, memberUid: string) =>
  doc(db, 'users', ownerUid, 'projects', projectId, 'members', memberUid).withConverter(zodConverter(Member))

// Invite is read raw — no zodConverter (it has no id field in the stored doc).
export const inviteDoc = (db: Firestore, token: string) =>
  doc(db, 'invites', token)

export const sharedProjectsCol = (db: Firestore, uid: string) =>
  collection(db, 'users', uid, 'sharedProjects').withConverter(zodConverter(SharedProjectRef))

export const sharedProjectDoc = (db: Firestore, uid: string, projectId: string) =>
  doc(db, 'users', uid, 'sharedProjects', projectId).withConverter(zodConverter(SharedProjectRef))
