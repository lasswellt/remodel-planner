// @nuxt/eslint generates the base flat config at .nuxt/eslint.config.mjs during
// `nuxt prepare`; withNuxt extends it with project rules.
//
// @nuxt/eslint-config 1.9.0's TypeScript feature does not activate against the
// installed typescript 6.x, so it leaves vue-eslint-parser without an inner
// script parser and TS syntax inside <script lang="ts"> fails to parse. We wire
// @typescript-eslint/parser for .vue script blocks explicitly here.
import withNuxt from './.nuxt/eslint.config.mjs'
import tseslint from 'typescript-eslint'

export default withNuxt({
  files: ['**/*.vue'],
  languageOptions: {
    parserOptions: {
      parser: tseslint.parser,
    },
  },
}).override('nuxt/rules', {
  rules: {
    'vue/multi-word-component-names': 'off',
  },
})
