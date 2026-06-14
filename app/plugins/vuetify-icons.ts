import { defineComponent, h } from 'vue'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import type { IconSet } from 'vuetify'
import { MDI_PATHS } from '~/utils/mdi-icons'

// Replaces the ~393 KB @mdi/font webfont with tree-shaken @mdi/js SVG paths,
// WITHOUT touching the ~100 `icon="mdi-..."` call sites. A custom default icon
// set resolves the project's `mdi-*` string names to their SVG path (from the
// generated MDI_PATHS map) and renders with Vuetify's own VSvgIcon so the markup
// is identical. Vuetify's internal component icons (checkbox ticks, select
// arrows, dialog close, sort chevrons, …) resolve via `aliases` to `svg:`-prefixed
// path strings that also land here — we strip the prefix and pass them through.
const VSvgIcon = mdi.component

export default defineNuxtPlugin((nuxtApp) => {
  const mdiCustom: IconSet = {
    component: defineComponent({
      name: 'MdiCustomIcon',
      props: {
        icon: { type: [String, Array], default: '' },
        tag: { type: [String, Object, Function], required: true },
      },
      setup(props) {
        return () => {
          let icon = props.icon
          if (typeof icon === 'string') {
            if (icon.startsWith('mdi-')) icon = MDI_PATHS[icon] ?? ''
            else if (icon.startsWith('svg:')) icon = icon.slice(4) // Vuetify alias prefix
          }
          return h(VSvgIcon, { icon, tag: props.tag })
        }
      },
    }),
  }

  nuxtApp.hook('vuetify:configuration', ({ vuetifyOptions }) => {
    vuetifyOptions.icons = {
      defaultSet: 'mdiCustom',
      aliases,
      sets: { mdiCustom },
    }
  })
})
