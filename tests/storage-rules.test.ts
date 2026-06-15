import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// Security-rules suite for storage.rules (run against the Storage emulator via
// `pnpm test:rules`). Locks in that project collaborators — not only the owning
// user — can upload room photos and purchase images/receipts, while uploads stay
// constrained to images / PDFs under 10MB.

const OWNER = 'owner-uid'
const MEMBER = 'member-uid'
const photoPath = `users/${OWNER}/projects/p1/rooms/r1/photos/ph1/original`
const receiptPath = `users/${OWNER}/projects/p1/rooms/r1/purchases/pu1/receipt`
const bytes = new Uint8Array([1, 2, 3, 4]) // tiny payload; rules don't inspect content

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-remodel',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})
afterAll(async () => { await testEnv.cleanup() })
beforeEach(async () => { await testEnv.clearStorage() })

const storage = (uid: string | null) =>
  (uid === null ? testEnv.unauthenticatedContext() : testEnv.authenticatedContext(uid)).storage()

describe('storage rules', () => {
  it('the owner can upload an image', async () => {
    await assertSucceeds(uploadBytes(ref(storage(OWNER), photoPath), bytes, { contentType: 'image/jpeg' }))
  })

  it('a project member (different uid) can upload a photo to the owner\'s path', async () => {
    await assertSucceeds(uploadBytes(ref(storage(MEMBER), photoPath), bytes, { contentType: 'image/jpeg' }))
  })

  it('a member can upload a PDF receipt', async () => {
    await assertSucceeds(uploadBytes(ref(storage(MEMBER), receiptPath), bytes, { contentType: 'application/pdf' }))
  })

  it('an unauthenticated upload is denied', async () => {
    await assertFails(uploadBytes(ref(storage(null), photoPath), bytes, { contentType: 'image/jpeg' }))
  })

  it('a non-image, non-PDF upload is denied', async () => {
    await assertFails(uploadBytes(ref(storage(MEMBER), photoPath), bytes, { contentType: 'text/plain' }))
  })

  it('an oversized upload (>10MB) is denied', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1)
    await assertFails(uploadBytes(ref(storage(MEMBER), photoPath), big, { contentType: 'image/jpeg' }))
  })
})
