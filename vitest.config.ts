import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Vitest owns unit tests (money math, rollups, gates, date logic). Playwright
// owns end-to-end smoke flows. No component snapshot tests.
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
  },
})
