import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { parsePsychology } from '../app/utils/research-parse'
import { parseInspiration } from '../app/utils/inspiration-parse'

// Build-time research content: reads the two content/research/*.md corpora,
// parses them (app/utils/research-parse.ts + inspiration-parse.ts), and serves
// the typed JSON as `virtual:research-content`. The markdown and markdown-it
// both stay out of the client bundle — only the parsed entries ship.

const VIRTUAL_ID = 'virtual:research-content'
const RESOLVED_ID = '\0research-content'

export function researchContentPlugin(rootDir: string): Plugin {
  const psychologyPath = resolve(rootDir, 'content/research/design-psychology.md')
  const inspirationPath = resolve(rootDir, 'content/research/inspiration-index.md')
  return {
    name: 'remodel:research-content',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      this.addWatchFile(psychologyPath)
      this.addWatchFile(inspirationPath)
      const psychology = parsePsychology(readFileSync(psychologyPath, 'utf8'))
      if (psychology.length === 0) {
        throw new Error(`research-content: no psychology entries parsed from ${psychologyPath}`)
      }
      const inspiration = parseInspiration(readFileSync(inspirationPath, 'utf8'))
      if (inspiration.length === 0) {
        throw new Error(`research-content: no inspiration seeds parsed from ${inspirationPath}`)
      }
      return [
        `export const psychology = ${JSON.stringify(psychology)}`,
        `export const inspiration = ${JSON.stringify(inspiration)}`,
        '',
      ].join('\n')
    },
    handleHotUpdate({ file, server }) {
      if (file === psychologyPath || file === inspirationPath) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
      }
    },
  }
}
