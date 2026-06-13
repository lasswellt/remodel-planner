import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { parsePsychology } from '../app/utils/research-parse'

// Build-time research content: reads content/research/design-psychology.md,
// parses it with markdown-it (app/utils/research-parse.ts), and serves the
// typed JSON as `virtual:research-content`. The markdown and markdown-it both
// stay out of the client bundle — only the parsed entries ship.

const VIRTUAL_ID = 'virtual:research-content'
const RESOLVED_ID = '\0research-content'

export function researchContentPlugin(rootDir: string): Plugin {
  const corpusPath = resolve(rootDir, 'content/research/design-psychology.md')
  return {
    name: 'remodel:research-content',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      this.addWatchFile(corpusPath)
      const entries = parsePsychology(readFileSync(corpusPath, 'utf8'))
      if (entries.length === 0) {
        throw new Error(`research-content: no entries parsed from ${corpusPath}`)
      }
      return `export const psychology = ${JSON.stringify(entries)}\n`
    },
    handleHotUpdate({ file, server }) {
      if (file === corpusPath) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
      }
    },
  }
}
