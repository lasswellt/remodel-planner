// Route guard: unauthenticated users are redirected to /signin; an
// authenticated user landing on /signin is bounced to the floorplan.
// getCurrentUser() (auto-imported from nuxt-vuefire) resolves once Firebase
// Auth has restored any persisted session, so the guard does not flicker.
export default defineNuxtRouteMiddleware(async (to) => {
  const user = await getCurrentUser()

  if (!user && to.path !== '/signin') {
    return navigateTo({ path: '/signin', query: { redirect: to.fullPath } })
  }

  if (user && to.path === '/signin') {
    return navigateTo('/')
  }
})
