import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Enable Firestore offline persistence with multi-tab support so the app keeps
// working through connectivity drops (UX9). Must run before anything calls
// getFirestore(); enforce:'pre' orders it ahead of VueFire's lazy Firestore
// access. If Firestore is somehow already initialized, fall back to the default
// cache rather than crash.
export default defineNuxtPlugin({
  name: 'firestore-offline',
  enforce: 'pre',
  setup() {
    const app = useFirebaseApp()
    try {
      initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    }
    catch (e) {
      console.warn(
        '[firestore-offline] persistent cache unavailable, using default cache:',
        (e as Error).message,
      )
    }
  },
})
