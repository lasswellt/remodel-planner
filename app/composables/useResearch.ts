import { psychology } from 'virtual:research-content'
import type { PsychologyEntry } from '~/utils/research-parse'

// Parsed Phase 1 design-psychology corpus, baked in at build time by
// build/research-content.ts. Static data — no reactivity needed.
const bySlug: Record<string, PsychologyEntry> = Object.fromEntries(
  psychology.map(entry => [entry.slug, entry]),
)

export function useResearch() {
  return { entries: psychology, bySlug }
}
