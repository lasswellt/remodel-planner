// Client-side image processing for Phase 10 photos — downscale + thumbnail in
// the browser (canvas), no Cloud Function. The dimension and backoff math are
// pure and unit-tested; the canvas path is browser-only.

// Fit (w,h) so the longest edge ≤ maxEdge, preserving aspect ratio. Never
// upscales (a small image is returned unchanged).
export function fitDimensions(w: number, h: number, maxEdge: number): { w: number, h: number } {
  const longest = Math.max(w, h)
  if (longest <= maxEdge || longest === 0) return { w, h }
  const scale = maxEdge / longest
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

// Exponential backoff with a ceiling: base·2^attempt, capped at max.
export function backoffDelay(attempt: number, base = 500, max = 8000): number {
  return Math.min(base * 2 ** attempt, max)
}

// Decode → draw to a fit-sized canvas → JPEG blob. Throws if decoding or
// encoding fails (the caller keeps the original File for retry — UX9).
export async function downscaleToBlob(file: File, maxEdge: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const { w, h } = fitDimensions(bitmap.width, bitmap.height, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Image encoding failed'))),
        'image/jpeg',
        quality,
      )
    })
  }
  finally {
    bitmap.close()
  }
}
