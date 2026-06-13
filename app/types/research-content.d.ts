declare module 'virtual:research-content' {
  import type { PsychologyEntry } from '~/utils/research-parse'
  import type { InspirationSeed } from '~/utils/inspiration-parse'

  export const psychology: PsychologyEntry[]
  export const inspiration: InspirationSeed[]
}
