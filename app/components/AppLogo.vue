<script setup lang="ts">
// Punchlist brand mark: an amber "plan tile" carrying a slate punch-list — two
// ticked rows and a bold check (the work, done). Inline SVG so it stays crisp
// at any size and needs no network fetch. `wordmark` adds the lockup text.
withDefaults(defineProps<{
  size?: number
  wordmark?: boolean
  /** Wordmark colour — defaults to currentColor so it inherits the bar. */
  wordmarkColor?: string
}>(), { size: 30, wordmark: false, wordmarkColor: 'currentColor' })
</script>

<template>
  <span class="app-logo">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Punchlist"
      class="app-logo__mark"
    >
      <rect x="2.5" y="2.5" width="27" height="27" rx="7.5" fill="#E8902B" />
      <rect x="2.5" y="2.5" width="27" height="27" rx="7.5" fill="url(#plg)" />
      <!-- punch-list rows -->
      <rect x="7.4" y="9.6" width="8.2" height="2.4" rx="1.2" fill="#1E3A5F" opacity="0.92" />
      <rect x="7.4" y="14.8" width="8.2" height="2.4" rx="1.2" fill="#1E3A5F" opacity="0.92" />
      <rect x="7.4" y="20" width="5.6" height="2.4" rx="1.2" fill="#1E3A5F" opacity="0.55" />
      <!-- the punch: a bold check -->
      <path
        d="M17.2 18.1l2.7 2.7 5.1-7.2"
        stroke="#1E3A5F"
        stroke-width="2.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <defs>
        <linearGradient id="plg" x1="2.5" y1="2.5" x2="29.5" y2="29.5" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFFFFF" stop-opacity="0.18" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
    <span
      v-if="wordmark"
      class="pl-wordmark app-logo__text"
      :style="{ color: wordmarkColor, fontSize: `${size * 0.62}px` }"
    >Punchlist</span>
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}
.app-logo__mark {
  display: block;
  flex: none;
}
</style>
