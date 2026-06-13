import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'

// Parser for content/research/design-psychology.md (Build Conventions: parse
// with markdown-it at build time into typed JSON — no @nuxt/content for two
// files). Pure over a markdown string so it runs in the Vite plugin, the
// Phase 11 importer, and unit tests alike. The corpus declares its structure
// contract in its own header:
//   ## <Principle name>
//   - **Slug:** stable anchor id (psychologyTag cross-links)
//   - **Rooms:** comma-separated room types
//   - **Summary:** 2-5 sentence mechanism + evidence
//   - **Applications:** bullet list
//   - **Sources:** bullet list of [title](url) — note

export interface ResearchSource {
  title: string
  url: string
  note: string
}

export interface PsychologyEntry {
  slug: string
  title: string
  rooms: string[]
  summary: string
  applications: string[]
  sources: ResearchSource[]
}

const md = new MarkdownIt()

function inlineText(token: Token): string {
  // Plain-text rendering of an inline token (strips ** and link markup).
  return (token.children ?? [])
    .filter(t => t.type === 'text' || t.type === 'code_inline')
    .map(t => t.content)
    .join('')
}

function parseSource(token: Token): ResearchSource | null {
  const children = token.children ?? []
  const open = children.findIndex(t => t.type === 'link_open')
  if (open === -1) return null
  const close = children.findIndex((t, i) => i > open && t.type === 'link_close')
  const url = children[open]!.attrGet('href') ?? ''
  const title = children
    .slice(open + 1, close)
    .filter(t => t.type === 'text')
    .map(t => t.content)
    .join('')
  const note = children
    .slice(close + 1)
    .filter(t => t.type === 'text')
    .map(t => t.content)
    .join('')
    .replace(/^\s*—\s*/, '')
    .trim()
  return { title: title.trim(), url, note }
}

// Group the flat token stream into h2 sections, then read each section's
// top-level bullet list as labeled fields. Nested bullet lists carry the
// Applications / Sources collections.
export function parsePsychology(markdown: string): PsychologyEntry[] {
  const tokens = md.parse(markdown, {})
  const entries: PsychologyEntry[] = []
  let current: PsychologyEntry | null = null
  let field: 'applications' | 'sources' | null = null
  let depth = 0

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type === 'heading_open' && t.tag === 'h2') {
      current = { slug: '', title: inlineText(tokens[i + 1]!).trim(), rooms: [], summary: '', applications: [], sources: [] }
      entries.push(current)
      field = null
      depth = 0
      continue
    }
    if (!current) continue
    if (t.type === 'bullet_list_open') depth++
    if (t.type === 'bullet_list_close') {
      depth--
      if (depth <= 1) field = null
    }
    if (t.type !== 'inline') continue

    const text = inlineText(t).trim()
    if (depth <= 1) {
      // Top-level field bullet: "<Label>: <value>" (markdown ** stripped).
      const m = text.match(/^(Slug|Rooms|Summary|Applications|Sources):\s*(.*)$/s)
      if (!m) continue
      const [, label, value] = m
      field = null
      if (label === 'Slug') current.slug = value!.trim()
      else if (label === 'Rooms') current.rooms = value!.split(',').map(r => r.trim()).filter(Boolean)
      else if (label === 'Summary') current.summary = value!.trim()
      else if (label === 'Applications') field = 'applications'
      else if (label === 'Sources') field = 'sources'
    }
    else if (field === 'applications') {
      if (text) current.applications.push(text)
    }
    else if (field === 'sources') {
      const source = parseSource(t)
      if (source) current.sources.push(source)
    }
  }
  return entries.filter(e => e.slug)
}
