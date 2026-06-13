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
