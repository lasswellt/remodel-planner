import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseInspiration } from '../app/utils/inspiration-parse'
import { parsePsychology } from '../app/utils/research-parse'
import { parseOpenGraph } from '../app/utils/og-fetch'
import { ROOM_TYPE_PSYCHOLOGY } from '../app/config/inspiration'
import { RoomType } from '../app/models'

const FIXTURE = `
## Kitchen

- **Slug:** kitchen

### [Houzz Kitchens](https://example.com/houzz)

- **Description:** Curated kitchen photos.

### [IKEA Kitchens](https://example.com/ikea)

- **Description:** Modular designs.
- **Images:**
  - https://img.example.com/ikea-1.jpg
  - https://img.example.com/ikea-2.jpg

## Bathroom

- **Slug:** bathroom

### [Spa Bath](https://example.com/spa)

- **Description:** Spa ideas.
`

describe('parseInspiration (fixture)', () => {
  it('extracts sources per room type with description + first image only', () => {
    const seeds = parseInspiration(FIXTURE)
    expect(seeds).toHaveLength(3)

    const houzz = seeds.find(s => s.title === 'Houzz Kitchens')!
    expect(houzz.roomType).toBe('kitchen')
    expect(houzz.url).toBe('https://example.com/houzz')
    expect(houzz.description).toBe('Curated kitchen photos.')
    expect(houzz.imageUrl).toBeUndefined()

    const ikea = seeds.find(s => s.title === 'IKEA Kitchens')!
    expect(ikea.imageUrl).toBe('https://img.example.com/ikea-1.jpg')

    expect(seeds.find(s => s.title === 'Spa Bath')!.roomType).toBe('bathroom')
  })

  it('does not attribute a source appearing before any Slug', () => {
    const seeds = parseInspiration('### [Orphan](https://x.com/o)\n- **Description:** none')
    expect(seeds).toHaveLength(0)
  })
})

describe('parseInspiration (real corpus)', () => {
  const md = readFileSync(resolve(__dirname, '../content/research/inspiration-index.md'), 'utf8')
  const seeds = parseInspiration(md)

  it('parses many seeds, all with valid room types and http URLs', () => {
    expect(seeds.length).toBeGreaterThan(10)
    const valid = new Set(RoomType.options as readonly string[])
    for (const s of seeds) {
      expect(valid.has(s.roomType), s.roomType).toBe(true)
      expect(s.url).toMatch(/^https?:\/\//)
      expect(s.title.length).toBeGreaterThan(3)
    }
  })

  it('gives kitchen at least 5 sources (spec minimum)', () => {
    expect(seeds.filter(s => s.roomType === 'kitchen').length).toBeGreaterThanOrEqual(5)
  })
})

describe('ROOM_TYPE_PSYCHOLOGY (no dead inspiration tags)', () => {
  const corpus = readFileSync(resolve(__dirname, '../content/research/design-psychology.md'), 'utf8')
  const slugs = new Set(parsePsychology(corpus).map(e => e.slug))

  it('maps every room type to tags that resolve to a real research slug', () => {
    for (const type of RoomType.options) {
      const tags = ROOM_TYPE_PSYCHOLOGY[type]
      expect(tags.length, type).toBeGreaterThanOrEqual(1)
      for (const tag of tags) {
        expect(slugs.has(tag), `${type} -> ${tag}`).toBe(true)
      }
    }
  })
})

describe('parseOpenGraph', () => {
  it('extracts og:title and og:image', () => {
    const html = `<html><head>
      <meta property="og:title" content="Modern Kitchen Ideas">
      <meta property="og:image" content="https://cdn.example.com/k.jpg">
    </head></html>`
    expect(parseOpenGraph(html)).toEqual({ title: 'Modern Kitchen Ideas', imageUrl: 'https://cdn.example.com/k.jpg' })
  })

  it('falls back to <title> and decodes entities', () => {
    const html = `<html><head><title>Tom &amp; Jerry&#39;s Bath</title></head></html>`
    expect(parseOpenGraph(html).title).toBe("Tom & Jerry's Bath")
  })

  it('ignores a non-http og:image', () => {
    const html = `<meta property="og:image" content="/relative.jpg"><title>X</title>`
    expect(parseOpenGraph(html).imageUrl).toBeUndefined()
  })

  it('returns an empty object for bare html', () => {
    expect(parseOpenGraph('<html></html>')).toEqual({})
  })
})
