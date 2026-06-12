// Dev-only hooks for automated browser smoke tests (the floorplan phase's
// completion criterion runs through a real browser against the dev project).
// import.meta.dev is compile-time false in production builds, so this entire
// body is tree-shaken out of `nuxt generate` output.
export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return

  const auth = useFirebaseAuth()
  const hooks = {
    // Anonymous sign-in path for test runs: the Google popup cannot be
    // automated headlessly. Anonymous auth is enabled on the dev project only
    // for the duration of a smoke test, then disabled again.
    async signInAnonymously(): Promise<string> {
      if (!auth) throw new Error('Firebase auth unavailable')
      const { signInAnonymously } = await import('firebase/auth')
      const cred = await signInAnonymously(auth)
      return cred.user.uid
    },
    uid(): string | null {
      return auth?.currentUser?.uid ?? null
    },
    async idToken(): Promise<string | null> {
      return (await auth?.currentUser?.getIdToken()) ?? null
    },
    async deleteCurrentUser(): Promise<void> {
      await auth?.currentUser?.delete()
    },
  }
  ;(window as Window & { __e2e?: typeof hooks }).__e2e = hooks
})
