<script setup lang="ts">
import { parseMoney } from '~/utils/money'
import { useProjectStore } from '~/stores/project'

// Create-project dialog, shared by the app-bar project menu and the
// no-projects empty state on the floorplan. Budget is typed in dollars and
// converted to integer cents at the input boundary (Standing Rule 5).
const open = defineModel<boolean>({ default: false })
const projectStore = useProjectStore()

const name = ref('')
const address = ref('')
const budget = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    address.value = ''
    budget.value = ''
  }
})

const budgetError = computed(() =>
  budget.value.trim() && parseMoney(budget.value) === null
    ? 'Enter a dollar amount like 25,000'
    : undefined,
)
const valid = computed(() => name.value.trim().length > 0 && !budgetError.value)

// Optimistic write (UX9): the store applies the project locally and returns
// immediately — no spinner, works offline.
function create() {
  if (!valid.value) return
  projectStore.createProject(
    name.value.trim(),
    parseMoney(budget.value) ?? 0,
    address.value.trim() || undefined,
  )
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card>
      <v-card-title>New project</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="create">
          <v-text-field
            v-model="name"
            label="Project name"
            placeholder="Maple St remodel"
            autofocus
          />
          <v-text-field
            v-model="address"
            label="Address (optional)"
            class="mt-2"
          />
          <v-text-field
            v-model="budget"
            label="Total budget (optional)"
            prefix="$"
            placeholder="50,000"
            :error-messages="budgetError"
            class="mt-2"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="create">
          Create project
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
