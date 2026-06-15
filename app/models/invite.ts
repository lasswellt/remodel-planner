import { z } from 'zod'
import { FirestoreTimestamp } from './common'

// users/{ownerUid}/projects/{projectId}/members/{memberUid}
// id = memberUid (injected by zodConverter from the doc key)
export const Member = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  role: z.literal('editor'),
  // The invite token this membership was granted by. Rules require it on create
  // and validate it against the (unexpired, matching) invite. Optional for
  // read back-compat with member docs created before this was enforced.
  inviteToken: z.string().min(1).optional(),
  email: z.string().optional(),
  displayName: z.string().optional(),
  addedAt: FirestoreTimestamp,
})
export type Member = z.infer<typeof Member>

// invites/{token} — read raw (no zodConverter); parsed manually in acceptInvite
export const Invite = z.object({
  ownerUid: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  role: z.literal('editor'),
  createdAt: FirestoreTimestamp,
  expiresAt: FirestoreTimestamp,
})
export type Invite = z.infer<typeof Invite>

// users/{uid}/sharedProjects/{projectId}
// id = projectId (injected by zodConverter from the doc key)
export const SharedProjectRef = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  role: z.literal('editor'),
})
export type SharedProjectRef = z.infer<typeof SharedProjectRef>
