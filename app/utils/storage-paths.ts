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

// One uploaded photo per item (a single object, overwritten on replace).
export function itemImagePath(uid: string, projectId: string, roomId: string, itemId: string): string {
  return `users/${uid}/projects/${projectId}/rooms/${roomId}/items/${itemId}/image`
}

// One receipt per item (image or PDF; overwritten on replace).
export function itemReceiptPath(uid: string, projectId: string, roomId: string, itemId: string): string {
  return `users/${uid}/projects/${projectId}/rooms/${roomId}/items/${itemId}/receipt`
}
