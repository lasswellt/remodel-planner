import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

// Vitest owns unit tests (money math, rollups, gates, date logic). Playwright
// owns end-to-end smoke flows. No component snapshot tests.
// The firestore-rules suite needs the Firestore emulator, so it is excluded here
// and run separately via `pnpm test:rules` (firebase emulators:exec).
export default defineConfig({
  resolve: {
    alias: {
      // Mirror Nuxt 4's srcDir aliases so unit tests import app code via ~/...
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: [...configDefaults.exclude, 'tests/firestore-rules.test.ts'],
  },
})
