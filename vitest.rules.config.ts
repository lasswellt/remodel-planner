import { defineConfig } from 'vitest/config'

// The Firestore security-rules suite. Runs against the Firestore emulator (the
// real firestore.rules), so it is kept out of the default `pnpm test` and run
// via `pnpm test:rules`, which boots the emulator with `firebase emulators:exec`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/firestore-rules.test.ts'],
    // Rules tests share one emulator + seed/clear it between cases; keep them serial.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
