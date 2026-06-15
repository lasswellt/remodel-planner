import { defineStore } from 'pinia'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { useCollection, useCurrentUser, useDocument, useFirestore } from 'vuefire'
import { Invite, type Member, type Project, type SharedProjectRef } from '~/models'
import { deleteProjectDeep } from '~/utils/firestore-cascade'
import {
  inviteDoc,
  memberDoc,
  membersCol,
  projectDoc,
  projectsCol,
  sharedProjectDoc,
  sharedProjectsCol,
} from '~/utils/firestore-paths'
import { useSyncStore } from '~/stores/sync'

// Domain store for projects, backed by VueFire reactive bindings. The data
// model is multi-project; the app bar switches between them. currentProjectId
// and currentProjectOwnerId persist across reloads to support shared projects.
export const useProjectStore = defineStore('project', () => {
  const db = useFirestore()
  const user = useCurrentUser()
  const sync = useSyncStore()

  const currentProjectId = useLocalStorage<string | null>('remodel.currentProjectId', null)
  // When viewing a shared project, this is the owner's uid (not the current user's).
  const currentProjectOwnerId = useLocalStorage<string | null>('remodel.currentProjectOwnerId', null)

  // The uid to use for all Firestore path construction — either own or owner's.
  const activeOwnerUid = computed<string | null>(() =>
    currentProjectOwnerId.value ?? user.value?.uid ?? null,
  )

  // Own projects
  const projectsSource = computed(() =>
    user.value ? projectsCol(db, user.value.uid) : null,
  )
  const projects = useCollection(projectsSource, { ssrKey: 'projects' })

  // Shared project pointers (lightweight refs under the current user)
  const sharedRefsSource = computed(() =>
    user.value ? sharedProjectsCol(db, user.value.uid) : null,
  )
  const sharedRefs = useCollection<SharedProjectRef>(sharedRefsSource, { ssrKey: 'sharedRefs' })

  // Active project document — path uses activeOwnerUid to support shared projects
  const currentSource = computed(() =>
    activeOwnerUid.value && currentProjectId.value
      ? projectDoc(db, activeOwnerUid.value, currentProjectId.value)
      : null,
  )
  const currentProject = useDocument(currentSource, { ssrKey: 'currentProject' })

  // Whether the current project is owned by someone else
  const isSharedProject = computed(() =>
    !!(user.value && currentProjectOwnerId.value && currentProjectOwnerId.value !== user.value.uid),
  )

  // Merged list for the project picker: own projects first, then shared
  const allProjects = computed(() => {
    const own = projects.value.map(p => ({ ...p, _shared: false as const }))
    const shared = sharedRefs.value.map(r => ({
      id: r.projectId,
      uid: r.ownerUid,
      name: r.projectName,
      _shared: true as const,
      _ownerUid: r.ownerUid,
    }))
    return [...own, ...shared]
  })

  // Reconcile persisted selection against reality when own projects load.
  // Shared projects are handled separately via sharedRefs.
  watch(projects, (list) => {
    const id = currentProjectId.value
    const ownerId = currentProjectOwnerId.value
    const myUid = user.value?.uid

    // If currently on an own project that no longer exists, fall back
    if (id && ownerId === myUid && !list.some(p => p.id === id)) {
      const firstShared = sharedRefs.value[0]
      if (firstShared) {
        currentProjectId.value = firstShared.projectId
        currentProjectOwnerId.value = firstShared.ownerUid
      }
      else {
        currentProjectId.value = list[0]?.id ?? null
        currentProjectOwnerId.value = list[0] ? myUid ?? null : null
      }
    }
    else if (!id && list.length > 0) {
      currentProjectId.value = list[0]!.id
      currentProjectOwnerId.value = myUid ?? null
    }
  })

  function selectProject(id: string, ownerUid?: string) {
    currentProjectId.value = id
    currentProjectOwnerId.value = ownerUid ?? user.value?.uid ?? null
  }

  function uid(): string {
    if (!user.value) throw new Error('project store: no signed-in user')
    return user.value.uid
  }

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
    currentProjectOwnerId.value = uid()
    return id
  }

  async function renameProject(id: string, name: string): Promise<void> {
    await sync.track(() => updateDoc(projectDoc(db, uid(), id), { name }))
  }

  // Owner-only (rules deny project-doc updates to members). Both fields are
  // integer-domain: cents and a whole-number percent.
  async function setBudget(id: string, totalBudgetCents: number, contingencyPct: number): Promise<void> {
    await sync.track(() =>
      updateDoc(projectDoc(db, uid(), id), { totalBudgetCents, contingencyPct }),
    )
  }

  async function removeProject(id: string): Promise<void> {
    const owner = uid()
    await sync.track(() => deleteProjectDeep(db, owner, id))
    if (currentProjectId.value === id) {
      const next = projects.value.find(p => p.id !== id)
      currentProjectId.value = next?.id ?? null
      currentProjectOwnerId.value = next ? owner : null
    }
  }

  // ---- sharing ----

  async function createInvite(projectId: string, projectName: string): Promise<string> {
    const owner = uid()
    const token = crypto.randomUUID()
    const now = Timestamp.now()
    const expires = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
    await setDoc(inviteDoc(db, token), {
      ownerUid: owner,
      projectId,
      projectName,
      role: 'editor' as const,
      createdAt: now,
      expiresAt: expires,
    })
    return token
  }

  async function acceptInvite(
    token: string,
  ): Promise<{ ownerUid: string, projectId: string, alreadyMember: boolean } | null> {
    const me = user.value
    if (!me) throw new Error('acceptInvite: no signed-in user')

    const snap = await getDoc(inviteDoc(db, token))
    if (!snap.exists()) return null

    const parsed = Invite.safeParse(snap.data())
    if (!parsed.success) return null
    const invite = parsed.data

    if (invite.expiresAt.toMillis() < Date.now()) return null
    if (invite.ownerUid === me.uid) return null // can't join own project

    // Idempotent: re-accepting a still-valid link is harmless. Membership is
    // determined by the member doc's prior existence, so the join page can tell
    // a fresh join from a repeat visit.
    const existing = await getDoc(memberDoc(db, invite.ownerUid, invite.projectId, me.uid))
    const alreadyMember = existing.exists()

    const sharedRef: SharedProjectRef = {
      id: invite.projectId,
      ownerUid: invite.ownerUid,
      projectId: invite.projectId,
      projectName: invite.projectName,
      role: 'editor',
    }
    // Only create the membership on a fresh join. Membership docs are immutable
    // (rules deny update), and re-accepting a still-valid link should not try to
    // rewrite one. The token is recorded so rules can validate the grant.
    if (!alreadyMember) {
      // zodConverter strips the id field on write, so include it here.
      const member: Member = {
        id: me.uid,
        uid: me.uid,
        role: 'editor',
        inviteToken: token,
        email: me.email ?? undefined,
        displayName: me.displayName ?? undefined,
        addedAt: Timestamp.now(),
      }
      await setDoc(memberDoc(db, invite.ownerUid, invite.projectId, me.uid), member)
    }
    await setDoc(sharedProjectDoc(db, me.uid, invite.projectId), sharedRef)

    return { ownerUid: invite.ownerUid, projectId: invite.projectId, alreadyMember }
  }

  async function leaveProject(ownerUid: string, projectId: string): Promise<void> {
    const me = uid()
    await deleteDoc(memberDoc(db, ownerUid, projectId, me))
    await deleteDoc(sharedProjectDoc(db, me, projectId))
    if (currentProjectId.value === projectId) {
      const next = projects.value[0]
      currentProjectId.value = next?.id ?? null
      currentProjectOwnerId.value = next ? me : null
    }
  }

  async function removeMember(projectId: string, memberUid: string): Promise<void> {
    const owner = uid()
    // Deleting the member doc revokes all access (rules read isMember()). The
    // owner cannot reach into the member's own subtree to delete their
    // sharedProjects pointer (rules forbid it), so we don't try — the now-stale
    // pointer is the member's to clear via "Leave shared project".
    await deleteDoc(memberDoc(db, owner, projectId, memberUid))
  }

  function getMembersCol(projectId: string) {
    return membersCol(db, uid(), projectId)
  }

  return {
    projects,
    sharedRefs,
    allProjects,
    currentProject,
    currentProjectId,
    activeOwnerUid,
    isSharedProject,
    selectProject,
    createProject,
    renameProject,
    setBudget,
    removeProject,
    createInvite,
    acceptInvite,
    leaveProject,
    removeMember,
    getMembersCol,
  }
})
