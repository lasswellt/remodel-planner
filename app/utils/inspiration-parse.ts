// Parser for content/research/inspiration-index.md (Phase 11 importer). The
// corpus declares its own structure contract in its header:
//   ## <Room type>
//   - **Slug:** <roomType key matching RoomType>
//   ### [<title>](<url>)
//   - **Description:** <one line>
//   - **Images:** optional bullet list of direct image URLs
// Pure over the markdown string so it runs in the Vite plugin and in tests.

export interface InspirationSeed {
  roomType: string
  title: string
  url: string
  description?: string
  imageUrl?: string
}

export function parseInspiration(markdown: string): InspirationSeed[] {
  const lines = markdown.split(/\r?\n/)
  const out: InspirationSeed[] = []
  let roomType = ''
  let current: InspirationSeed | null = null
  let inImages = false

  for (const raw of lines) {
    const line = raw.trimEnd()

    // Source heading: ### [title](url)
    const h3 = line.match(/^###\s+\[(.+?)\]\((https?:\/\/[^)\s]+)\)/)
    if (h3) {
      current = { roomType, title: h3[1]!.trim(), url: h3[2]!.trim() }
      if (roomType) out.push(current)
      inImages = false
      continue
    }

    // Room-type section reset: a new ## clears the type until its Slug bullet.
    if (/^##\s+/.test(line)) {
      roomType = ''
      current = null
      inImages = false
      continue
    }

    const slug = line.match(/^- \*\*Slug:\*\*\s*`?([a-z0-9-]+)`?/)
    if (slug) {
      roomType = slug[1]!
      continue
    }

    const desc = line.match(/^- \*\*Description:\*\*\s*(.+)$/)
    if (desc && current) {
      current.description = desc[1]!.trim()
      inImages = false
      continue
    }

    if (/^- \*\*Images:\*\*/.test(line)) {
      inImages = true
      continue
    }

    const img = line.match(/^\s+-\s+(https?:\/\/\S+)$/)
    if (img && current && inImages && !current.imageUrl) {
      current.imageUrl = img[1]!.trim()
    }
  }

  return out
}
