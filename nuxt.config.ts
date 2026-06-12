// https://nuxt.com/docs/api/configuration/nuxt-config
//
// Single-page app (ssr: false) served as static assets by Firebase Hosting.
// Firebase web config is injected per environment from .env.<mode> (see
// .env.example): `nuxt dev` loads .env.development (binds to the dev project);
// `nuxt generate` in production mode loads .env.production. There is no code
// path that lets a dev session reach prod — the config is baked from the env
// active at build time.

const firebaseConfig = {
  apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
}

// App Check is wired only when a reCAPTCHA Enterprise site key is present.
// Dev uses a debug token (FIREBASE_APPCHECK_DEBUG_TOKEN, never committed);
// prod enforcement is switched on during the deploy phase.
const recaptchaKey = process.env.NUXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: true },

  modules: [
    'vuetify-nuxt-module',
    '@pinia/nuxt',
    'nuxt-vuefire',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
  ],

  css: ['@mdi/font/css/materialdesignicons.css'],

  app: {
    head: {
      title: 'Remodel Planner',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1565C0' },
        { name: 'description', content: 'Plan a room-by-room home remodel: floorplan, checklists, budgets, tasks, selections, permits, photos.' },
      ],
    },
  },

  vuefire: {
    config: firebaseConfig,
    // No emulators — dev runs directly against the dev Firebase project
    // (project rule). Disabling the probe also avoids a 10s hub-connect timeout.
    emulators: { enabled: false },
    auth: {
      enabled: true,
      sessionCookie: false,
    },
    ...(recaptchaKey
      ? {
          appCheck: {
            debug: process.env.NODE_ENV !== 'production',
            isTokenAutoRefreshEnabled: true,
            provider: 'ReCaptchaEnterprise',
            key: recaptchaKey,
          },
        }
      : {}),
  },

  vuetify: {
    moduleOptions: {
      styles: true,
    },
    vuetifyOptions: {
      icons: { defaultSet: 'mdi' },
      theme: {
        defaultTheme: 'light',
        themes: {
          light: {
            dark: false,
            colors: {
              primary: '#1565C0',
              secondary: '#5B7083',
              surface: '#FCFCFF',
              error: '#BA1A1A',
              success: '#2E7D32',
              warning: '#E65100',
              info: '#0277BD',
            },
          },
          dark: {
            dark: true,
            colors: {
              primary: '#A6C8FF',
              secondary: '#BBC7DB',
              error: '#FFB4AB',
              success: '#7DDA87',
              warning: '#FFB77C',
              info: '#82CFFF',
            },
          },
        },
      },
      defaults: {
        VBtn: { variant: 'flat' },
        VCard: { variant: 'elevated' },
        VTextField: { variant: 'outlined', density: 'comfortable' },
        VSelect: { variant: 'outlined', density: 'comfortable' },
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Remodel Planner',
      short_name: 'Remodel',
      description: 'Room-by-room home remodel planner.',
      theme_color: '#1565C0',
      background_color: '#FCFCFF',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },

  runtimeConfig: {
    public: {
      firebase: firebaseConfig,
      recaptchaEnterpriseKey: recaptchaKey ?? '',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  eslint: {
    config: { stylistic: false },
  },
})
