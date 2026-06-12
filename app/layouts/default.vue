<script setup lang="ts">
import { NAV_ITEMS } from '~/config/nav'
import { useSyncStore } from '~/stores/sync'

// Rail-capable navigation drawer. Drawer nav is secondary to the floorplan
// (UX4); on mobile it collapses behind the app-bar toggle.
const { mobile } = useDisplay()

// UX9: reflect connectivity + in-flight writes without ever blocking the UI.
const sync = useSyncStore()
const online = useOnline()
watch(online, value => sync.setOnline(value), { immediate: true })
const drawer = ref(true)
const rail = ref(false)

watchEffect(() => {
  // Mobile: drawer is an overlay, never rail.
  if (mobile.value) rail.value = false
})

const user = useCurrentUser()
const auth = useFirebaseAuth()

async function signOut() {
  if (auth) await auth.signOut()
  await navigateTo('/signin')
}

const themeName = useState<'light' | 'dark'>('theme', () => 'light')
const theme = useTheme()
watch(themeName, (t) => { theme.global.name.value = t }, { immediate: true })
function toggleTheme() {
  themeName.value = themeName.value === 'light' ? 'dark' : 'light'
}
</script>

<template>
  <v-app>
    <v-app-bar :elevation="1" color="surface">
      <v-app-bar-nav-icon
        :icon="mobile ? 'mdi-menu' : (rail ? 'mdi-chevron-right' : 'mdi-chevron-left')"
        aria-label="Toggle navigation"
        @click="mobile ? (drawer = !drawer) : (rail = !rail)"
      />
      <v-app-bar-title>Remodel Planner</v-app-bar-title>
      <v-spacer />
      <!-- UX9: persistent offline pill + subtle sync indicator; never a spinner. -->
      <v-chip
        v-if="!sync.isOnline"
        color="warning"
        variant="tonal"
        size="small"
        prepend-icon="mdi-cloud-off-outline"
        class="mr-2"
      >
        Offline — changes will sync
      </v-chip>
      <v-fade-transition>
        <v-icon
          v-if="sync.isSyncing"
          icon="mdi-cloud-sync-outline"
          class="mr-2"
          aria-label="Syncing changes"
        />
      </v-fade-transition>
      <!-- Project ring lands here in the rollup phases (UX1). -->
      <v-btn
        :icon="themeName === 'light' ? 'mdi-weather-night' : 'mdi-weather-sunny'"
        :aria-label="themeName === 'light' ? 'Switch to dark theme' : 'Switch to light theme'"
        variant="text"
        @click="toggleTheme"
      />
      <v-menu v-if="user" location="bottom end">
        <template #activator="{ props }">
          <v-btn icon="mdi-account-circle" aria-label="Account" variant="text" v-bind="props" />
        </template>
        <v-list density="compact" min-width="220">
          <v-list-item :title="user.displayName || 'Signed in'" :subtitle="user.email || undefined" />
          <v-divider />
          <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="signOut" />
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      :rail="rail && !mobile"
      :permanent="!mobile"
      :temporary="mobile"
      expand-on-hover
    >
      <v-list nav density="comfortable">
        <v-list-item
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          exact
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="pa-4 pa-sm-6">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
