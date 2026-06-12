<script setup lang="ts">
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

definePageMeta({ layout: 'auth' })

const auth = useFirebaseAuth()
const route = useRoute()

const pending = ref(false)
const error = ref<string | null>(null)

async function signInWithGoogle() {
  if (!auth) {
    error.value = 'Auth is not ready yet — try again in a moment.'
    return
  }
  pending.value = true
  error.value = null
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(auth, provider)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(redirect)
  }
  catch (e) {
    const code = (e as { code?: string }).code ?? ''
    error.value = code === 'auth/popup-closed-by-user'
      ? 'Sign-in cancelled.'
      : `Sign-in failed: ${(e as Error).message}`
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <v-card class="pa-2" max-width="420" width="100%" elevation="3" rounded="lg">
    <v-card-item class="text-center pt-8">
      <v-icon icon="mdi-floor-plan" size="48" color="primary" class="mb-2" />
      <v-card-title class="text-h5">Remodel Planner</v-card-title>
      <v-card-subtitle>Plan your remodel, room by room.</v-card-subtitle>
    </v-card-item>

    <v-card-text class="pt-4">
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-4"
        :text="error"
      />
      <v-btn
        block
        size="large"
        color="primary"
        prepend-icon="mdi-google"
        :loading="pending"
        @click="signInWithGoogle"
      >
        Sign in with Google
      </v-btn>
    </v-card-text>

    <v-card-text class="text-caption text-medium-emphasis text-center pb-6">
      Single-user app. Your data stays in your own Firebase project.
    </v-card-text>
  </v-card>
</template>
