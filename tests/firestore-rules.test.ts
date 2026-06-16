import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where, Timestamp } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// Security-rules suite for firestore.rules, run against the Firestore emulator
// (see `pnpm test:rules`). Centres on the project-sharing membership rule — the
// high-severity self-grant hole fixed in fix(security) — plus core ownership.

const OWNER = 'owner-uid'
const MEMBER = 'member-uid'
const STRANGER = 'stranger-uid'
const PROJECT = 'proj1'
const memberPath = (m: string) => `users/${OWNER}/projects/${PROJECT}/members/${m}`
const roomPath = (r = 'room1') => `users/${OWNER}/projects/${PROJECT}/rooms/${r}`

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-remodel',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(async () => { await testEnv.cleanup() })
beforeEach(async () => { await testEnv.clearFirestore() })

function db(uid: string | null) {
  return uid === null
    ? testEnv.unauthenticatedContext().firestore()
    : testEnv.authenticatedContext(uid).firestore()
}

async function seed(fn: (ctx: { firestore: () => ReturnType<typeof db> }) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(fn as never)
}

async function seedProject() {
  await seed(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, `users/${OWNER}/projects/${PROJECT}`), {
      uid: OWNER, name: 'Reno', totalBudgetCents: 1000, contingencyPct: 15, createdAt: Timestamp.now(),
    })
    await setDoc(doc(d, roomPath()), { uid: OWNER, name: 'Kitchen', type: 'kitchen', status: 'planned', geometry: {} })
  })
}

async function seedInvite(token: string, opts: { expired?: boolean, ownerUid?: string, projectId?: string } = {}) {
  const { expired = false, ownerUid = OWNER, projectId = PROJECT } = opts
  await seed(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `invites/${token}`), {
      ownerUid,
      projectId,
      projectName: 'Reno',
      role: 'editor',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + (expired ? -60_000 : 7 * 24 * 3600 * 1000)),
    })
  })
}

const member = (uid: string, inviteToken?: string) => ({
  uid, role: 'editor', addedAt: Timestamp.now(), ...(inviteToken ? { inviteToken } : {}),
})
const validRoom = { uid: OWNER, name: 'Bath', type: 'bathroom', status: 'planned', geometry: {} }

describe('ownership', () => {
  it('owner reads + writes their own project and rooms', async () => {
    await seedProject()
    await assertSucceeds(getDoc(doc(db(OWNER), `users/${OWNER}/projects/${PROJECT}`)))
    await assertSucceeds(setDoc(doc(db(OWNER), roomPath('r2')), validRoom))
  })

  it('a stranger (non-member) cannot read another user\'s project or rooms', async () => {
    await seedProject()
    await assertFails(getDoc(doc(db(STRANGER), `users/${OWNER}/projects/${PROJECT}`)))
    await assertFails(getDoc(doc(db(STRANGER), roomPath())))
  })

  it('an unauthenticated client is denied', async () => {
    await seedProject()
    await assertFails(getDoc(doc(db(null), roomPath())))
  })
})

describe('membership self-grant (the patched hole)', () => {
  it('denies a self-granted membership with NO invite token', async () => {
    await seedProject()
    await assertFails(setDoc(doc(db(STRANGER), memberPath(STRANGER)), member(STRANGER)))
  })

  it('denies a self-granted membership with a BOGUS invite token', async () => {
    await seedProject()
    await assertFails(setDoc(doc(db(STRANGER), memberPath(STRANGER)), member(STRANGER, 'no-such-token')))
  })

  it('denies a membership backed by an EXPIRED invite', async () => {
    await seedProject()
    await seedInvite('tok-expired', { expired: true })
    await assertFails(setDoc(doc(db(MEMBER), memberPath(MEMBER)), member(MEMBER, 'tok-expired')))
  })

  it('denies a token issued for a DIFFERENT project', async () => {
    await seedProject()
    await seedInvite('tok-other', { projectId: 'some-other-project' })
    await assertFails(setDoc(doc(db(MEMBER), memberPath(MEMBER)), member(MEMBER, 'tok-other')))
  })

  it('denies a non-editor role even with a valid token', async () => {
    await seedProject()
    await seedInvite('tok-ok')
    await assertFails(setDoc(doc(db(MEMBER), memberPath(MEMBER)), { uid: MEMBER, role: 'owner', inviteToken: 'tok-ok', addedAt: Timestamp.now() }))
  })

  it('denies creating a membership for SOMEONE ELSE\'s uid', async () => {
    await seedProject()
    await seedInvite('tok-ok')
    // attacker (MEMBER) tries to write a membership doc keyed to STRANGER
    await assertFails(setDoc(doc(db(MEMBER), memberPath(STRANGER)), member(STRANGER, 'tok-ok')))
  })
})

describe('membership happy path', () => {
  it('a valid, unexpired invite lets the invitee join and then access the project', async () => {
    await seedProject()
    await seedInvite('tok-ok')

    await assertSucceeds(setDoc(doc(db(MEMBER), memberPath(MEMBER)), member(MEMBER, 'tok-ok')))
    // now a member: can read + write the owner's rooms (writes pinned to owner uid)
    await assertSucceeds(getDoc(doc(db(MEMBER), roomPath())))
    await assertSucceeds(setDoc(doc(db(MEMBER), roomPath('r3')), validRoom))
  })

  it('membership is immutable once created (no update)', async () => {
    await seedProject()
    await seed(async ctx => setDoc(doc(ctx.firestore(), memberPath(MEMBER)), member(MEMBER, 'tok-ok')))
    await assertFails(updateDoc(doc(db(MEMBER), memberPath(MEMBER)), { role: 'editor', extra: 1 }))
  })

  it('owner or member can delete the membership (revoke / leave)', async () => {
    await seed(async ctx => setDoc(doc(ctx.firestore(), memberPath(MEMBER)), member(MEMBER, 'tok-ok')))
    await assertSucceeds(import('firebase/firestore').then(m => m.deleteDoc(doc(db(OWNER), memberPath(MEMBER)))))
  })
})

describe('purchases collection-group read', () => {
  it('owner and member can group-read purchases; a stranger cannot', async () => {
    await seedProject()
    await seed(async (ctx) => {
      const d = ctx.firestore()
      await setDoc(doc(d, `users/${OWNER}/projects/${PROJECT}/rooms/room1/purchases/p1`), {
        uid: OWNER, projectId: PROJECT, roomId: 'room1', title: 'Faucet', group: 'Fixtures', status: 'idea', rank: 0,
      })
      await setDoc(doc(d, memberPath(MEMBER)), member(MEMBER, 'tok'))
    })
    const groupQuery = (uid: string) =>
      query(collectionGroup(db(uid), 'purchases'), where('uid', '==', OWNER), where('projectId', '==', PROJECT))
    await assertSucceeds(getDocs(groupQuery(OWNER)))
    await assertSucceeds(getDocs(groupQuery(MEMBER)))
    await assertFails(getDocs(groupQuery(STRANGER)))
  })
})

describe('items (merged Shopping & Selections)', () => {
  const itemPath = (id = 'i1') => `users/${OWNER}/projects/${PROJECT}/rooms/room1/items/${id}`
  const validItem = { uid: OWNER, projectId: PROJECT, roomId: 'room1', label: 'Vanity', status: 'purchased' }

  it('owner/member can write a valid item; a bad status is rejected', async () => {
    await seedProject()
    await seed(async ctx => setDoc(doc(ctx.firestore(), memberPath(MEMBER)), member(MEMBER, 'tok')))
    await assertSucceeds(setDoc(doc(db(OWNER), itemPath()), validItem))
    await assertSucceeds(setDoc(doc(db(MEMBER), itemPath('i2')), validItem))
    await assertFails(setDoc(doc(db(OWNER), itemPath('i3')), { ...validItem, status: 'ordered' }))
    await assertFails(setDoc(doc(db(OWNER), itemPath('i4')), { uid: OWNER, projectId: PROJECT, roomId: 'room1', status: 'idea' }))
  })

  it('owner and member can group-read items; a stranger cannot', async () => {
    await seedProject()
    await seed(async (ctx) => {
      const d = ctx.firestore()
      await setDoc(doc(d, itemPath()), validItem)
      await setDoc(doc(d, memberPath(MEMBER)), member(MEMBER, 'tok'))
    })
    const groupQuery = (uid: string) =>
      query(collectionGroup(db(uid), 'items'), where('uid', '==', OWNER), where('projectId', '==', PROJECT))
    await assertSucceeds(getDocs(groupQuery(OWNER)))
    await assertSucceeds(getDocs(groupQuery(MEMBER)))
    await assertFails(getDocs(groupQuery(STRANGER)))
  })

  // Partial updateDoc() payloads must pass validItem(): request.resource.data on
  // an update is the FULL post-write doc (label/status carry over from the
  // existing doc), so the always-required fields are still present.
  it('allows partial updates (rank / status / image / receipt-clear) on an item', async () => {
    await seedProject()
    await seed(async ctx => setDoc(doc(ctx.firestore(), itemPath()), validItem))
    await assertSucceeds(updateDoc(doc(db(OWNER), itemPath()), { rank: 3 }))
    await assertSucceeds(updateDoc(doc(db(OWNER), itemPath()), { status: 'to-buy' }))
    await assertSucceeds(updateDoc(doc(db(OWNER), itemPath()), { imageUrl: 'https://example.com/x.jpg', imagePath: `users/${OWNER}/projects/${PROJECT}/rooms/room1/items/i1/image` }))
  })
})

describe('invite tokens', () => {
  it('owner can create an invite for their own project; others cannot impersonate the owner', async () => {
    await assertSucceeds(setDoc(doc(db(OWNER), 'invites/t1'), {
      ownerUid: OWNER, projectId: PROJECT, projectName: 'Reno', role: 'editor',
      createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 3600_000),
    }))
    await assertFails(setDoc(doc(db(STRANGER), 'invites/t2'), {
      ownerUid: OWNER, projectId: PROJECT, projectName: 'Reno', role: 'editor',
      createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 3600_000),
    }))
  })
})
