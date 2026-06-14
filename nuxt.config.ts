// https://nuxt.com/docs/api/configuration/nuxt-config
//
// Single-page app (ssr: false) served as static assets by Firebase Hosting.
// Firebase web config is injected per environment from .env.<mode> (see
// .env.example): `nuxt dev` loads .env.development (binds to the dev project);
// `nuxt generate` in production mode loads .env.production. There is no code
// path that lets a dev session reach prod — the config is baked from the env
// active at build time.

import { fileURLToPath } from 'node:url'
// Build-time markdown-it parse of content/research/*.md → virtual module
// (Build Conventions: no @nuxt/content for two files).
import { researchContentPlugin } from './build/research-content'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

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

  // Icons ship as tree-shaken @mdi/js SVG paths (see app/plugins/vuetify-icons.ts),
  // not the full @mdi/font webfont — the global CSS is all that's loaded here.
  css: ['~/assets/css/app.css'],

  app: {
    head: {
      title: 'Punchlist — remodel planner',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1E3A5F' },
        { name: 'description', content: 'Punchlist — plan a room-by-room home remodel from demo to done: floorplan, checklists, budgets, tasks, selections, permits, photos.' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap',
        },
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
      // 'mdi-svg' stops the module auto-injecting the @mdi/font CSS; the runtime
      // set is overridden to a custom string→path resolver in the icons plugin.
      icons: { defaultSet: 'mdi-svg' },
      // "Architectural Slate" — deep slate navy + warm amber accent, blueprint
      // feel. `accent` is a custom token (use color="accent" on components).
      theme: {
        defaultTheme: 'light',
        themes: {
          light: {
            dark: false,
            colors: {
              'primary': '#1E3A5F',
              'on-primary': '#FFFFFF',
              'secondary': '#51637A',
              'accent': '#E8902B',
              'on-accent': '#241404',
              'background': '#EDF1F6',
              'surface': '#FFFFFF',
              'on-surface': '#16222F',
              'surface-variant': '#E2E8F0',
              'error': '#C0413B',
              'success': '#2F8F6B',
              'warning': '#C9761A',
              'info': '#2E6F9E',
            },
          },
          dark: {
            dark: true,
            colors: {
              'primary': '#9DC0EA',
              'on-primary': '#06121F',
              'secondary': '#9FB0C4',
              'accent': '#F2A33C',
              'on-accent': '#241404',
              'background': '#0E1620',
              'surface': '#16212E',
              'on-surface': '#DCE6F2',
              'surface-variant': '#243140',
              'error': '#FFB4AB',
              'success': '#7DDA87',
              'warning': '#F2B872',
              'info': '#82CFFF',
            },
          },
        },
      },
      defaults: {
        VBtn: { variant: 'flat', rounded: 'lg' },
        VCard: { variant: 'elevated', rounded: 'lg' },
        VChip: { rounded: 'md' },
        VTextField: { variant: 'outlined', density: 'comfortable' },
        VSelect: { variant: 'outlined', density: 'comfortable' },
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Punchlist — remodel planner',
      short_name: 'Punchlist',
      description: 'Room-by-room home remodel planner. From demo to done.',
      theme_color: '#1E3A5F',
      background_color: '#EDF1F6',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: 'logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
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

  vite: {
    plugins: [researchContentPlugin(rootDir)],
    optimizeDeps: {
      include: ['vuefire', 'zod', 'firebase/firestore', 'firebase/auth'],
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
