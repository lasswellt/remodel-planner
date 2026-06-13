import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parsePsychology } from '../app/utils/research-parse'

// Parses the REAL corpus — the same file the Vite plugin feeds the app — so a
// drive-by edit to design-psychology.md that breaks the field contract fails
// here, not silently at render time.
const corpus = readFileSync(
  resolve(__dirname, '../content/research/design-psychology.md'),
  'utf8',
)
const entries = parsePsychology(corpus)

const EXPECTED_SLUGS = [
  'color-psychology',
  'lighting-circadian',
  'biophilic-design',
  'spatial-flow-prospect-refuge',
  'ceiling-height-volume',
  'clutter-cognitive-load',
  'acoustic-comfort',
  'texture-material-warmth',
  'entry-sequence-transitions',
  'bathroom-as-retreat',
]

describe('parsePsychology (real corpus)', () => {
  it('parses all 10 principles with their stable slugs', () => {
    expect(entries.map(e => e.slug)).toEqual(EXPECTED_SLUGS)
  })

  it('every entry carries the full field contract', () => {
    for (const e of entries) {
      expect(e.title.length, e.slug).toBeGreaterThan(3)
      expect(e.summary.length, e.slug).toBeGreaterThan(100)
      expect(e.rooms.length, e.slug).toBeGreaterThan(0)
      expect(e.applications.length, e.slug).toBeGreaterThanOrEqual(3)
      expect(e.sources.length, e.slug).toBeGreaterThanOrEqual(2)
    }
  })

  it('sources resolve to https URLs with titles', () => {
    for (const e of entries) {
      for (const s of e.sources) {
        expect(s.url, `${e.slug}: ${s.title}`).toMatch(/^https:\/\//)
        expect(s.title.length, e.slug).toBeGreaterThan(5)
      }
    }
  })

  it('summaries are plain text (markdown markup stripped)', () => {
    for (const e of entries) {
      expect(e.summary).not.toContain('**')
      expect(e.summary).not.toContain('](')
    }
  })
})
