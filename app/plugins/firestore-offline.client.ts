import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Enable Firestore offline persistence with multi-tab support so the app keeps
// working through connectivity drops (UX9). This must run AFTER nuxt-vuefire's
// app plugin creates the Firebase app (a default plugin that provides
// $firebaseApp) but BEFORE the first lazy getFirestore() — which only happens
// when a store/composable calls useFirestore() during component setup, i.e.
// after all plugins. A default app/ plugin sits in exactly that window; using
// enforce:'pre' here (the previous bug) ran ahead of app creation, so
// useFirebaseApp() was undefined and persistence silently fell back to the
// in-memory cache. If Firestore is somehow already initialized, fall back to
// the default cache rather than crash.
export default defineNuxtPlugin({
  name: 'firestore-offline',
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
