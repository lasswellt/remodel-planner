// Best-effort OpenGraph extraction for the "Add by URL" flow. parseOpenGraph is
// pure (unit-tested); fetchOpenGraph does the CORS-limited network call and
// resolves to {} on any failure so the dialog falls back to manual entry.

export interface OpenGraph {
  title?: string
  imageUrl?: string
}

function metaContent(html: string, key: string): string | undefined {
  // Match a <meta> tag carrying property=key or name=key, in either attribute
  // order, then pull its content.
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  if (!tag) return undefined
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1]
  return content?.trim() || undefined
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
}

export function parseOpenGraph(html: string): OpenGraph {
  const out: OpenGraph = {}
  const title = metaContent(html, 'og:title')
    ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
  if (title) out.title = decodeEntities(title)

  const image = metaContent(html, 'og:image') ?? metaContent(html, 'og:image:url')
  if (image && /^https?:\/\//.test(image)) out.imageUrl = image
  return out
}

export async function fetchOpenGraph(url: string): Promise<OpenGraph> {
  try {
    const res = await fetch(url, { mode: 'cors', redirect: 'follow' })
    if (!res.ok) return {}
    return parseOpenGraph(await res.text())
  }
  catch {
    // CORS block or network failure — the caller falls back to manual entry.
    return {}
  }
}
