// Firebase Storage object paths for photos. Mirrors the Firestore layout
// (Phase 3): users/{uid}/projects/{pid}/rooms/{rid}/photos/{photoId}/{original|thumb}.
// Storage rules scope by the leading users/{uid} segment (owner-only).

export function photoDir(uid: string, projectId: string, roomId: string, photoId: string): string {
  return `users/${uid}/projects/${projectId}/rooms/${roomId}/photos/${photoId}`
}

export function photoOriginalPath(uid: string, projectId: string, roomId: string, photoId: string): string {
  return `${photoDir(uid, projectId, roomId, photoId)}/original`
}

export function photoThumbPath(uid: string, projectId: string, roomId: string, photoId: string): string {
  return `${photoDir(uid, projectId, roomId, photoId)}/thumb`
}

// One uploaded photo per purchase item (a single object, overwritten on replace).
export function purchaseImagePath(uid: string, projectId: string, roomId: string, purchaseId: string): string {
  return `users/${uid}/projects/${projectId}/rooms/${roomId}/purchases/${purchaseId}/image`
}

// One receipt per purchase item (image or PDF; overwritten on replace).
export function purchaseReceiptPath(uid: string, projectId: string, roomId: string, purchaseId: string): string {
  return `users/${uid}/projects/${projectId}/rooms/${roomId}/purchases/${purchaseId}/receipt`
}
