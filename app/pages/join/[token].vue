<script setup lang="ts">
import { getCurrentUser } from 'vuefire'
import { useProjectStore } from '~/stores/project'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const token = route.params.token as string

const projectStore = useProjectStore()

const state = ref<'loading' | 'joining' | 'success' | 'already-member' | 'expired' | 'error'>('loading')
const errorMsg = ref('')

onMounted(async () => {
  // Ensure auth is settled before attempting to accept
  const user = await getCurrentUser()
  if (!user) {
    await navigateTo(`/signin?redirect=/join/${token}`)
    return
  }

  state.value = 'joining'
  try {
    const result = await projectStore.acceptInvite(token)
    if (!result) {
      state.value = 'expired'
      return
    }
    // Select the joined project either way; the banner distinguishes a fresh
    // join from a repeat visit.
    projectStore.selectProject(result.projectId, result.ownerUid)
    state.value = result.alreadyMember ? 'already-member' : 'success'
    setTimeout(() => navigateTo('/'), 1800)
  }
  catch (e) {
    state.value = 'error'
    errorMsg.value = (e as Error).message ?? ''
  }
})
</script>

<template>
  <v-card class="pa-2" max-width="420" width="100%" elevation="3" rounded="lg">
    <v-card-item class="text-center pt-8">
      <v-icon icon="mdi-floor-plan" size="48" color="primary" class="mb-2" />
      <v-card-title class="text-h5">Remodel Planner</v-card-title>
    </v-card-item>

    <v-card-text class="text-center pb-8">
      <div v-if="state === 'loading' || state === 'joining'">
        <v-progress-circular indeterminate color="primary" class="mb-4" />
        <p class="text-body-1">Joining project…</p>
      </div>

      <div v-else-if="state === 'success'">
        <v-icon icon="mdi-check-circle-outline" color="success" size="48" class="mb-4" />
        <p class="text-body-1 font-weight-medium">You've joined the project!</p>
        <p class="text-body-2 text-medium-emphasis">Redirecting…</p>
      </div>

      <div v-else-if="state === 'already-member'">
        <v-icon icon="mdi-check-circle-outline" color="info" size="48" class="mb-4" />
        <p class="text-body-1">You're already a member of this project.</p>
        <p class="text-body-2 text-medium-emphasis">Redirecting…</p>
      </div>

      <div v-else-if="state === 'expired'">
        <v-icon icon="mdi-clock-alert-outline" color="warning" size="48" class="mb-4" />
        <p class="text-body-1 font-weight-medium">This invite link has expired or is invalid.</p>
        <p class="text-body-2 text-medium-emphasis mb-4">Ask the project owner to generate a new one.</p>
        <v-btn color="primary" variant="tonal" to="/">Go home</v-btn>
      </div>

      <div v-else>
        <v-icon icon="mdi-alert-circle-outline" color="error" size="48" class="mb-4" />
        <p class="text-body-1 font-weight-medium">Something went wrong.</p>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ errorMsg }}</p>
        <v-btn color="primary" variant="tonal" to="/">Go home</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
