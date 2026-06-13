<script setup lang="ts">
import { useCollection } from 'vuefire'
import { useProjectStore } from '~/stores/project'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const projectStore = useProjectStore()

const project = computed(() => projectStore.currentProject)
const members = useCollection(
  computed(() =>
    project.value ? projectStore.getMembersCol(project.value.id) : null,
  ),
)

const inviteLink = ref<string | null>(null)
const generating = ref(false)
const copied = ref(false)
const removingUid = ref<string | null>(null)

async function generateLink() {
  if (!project.value) return
  generating.value = true
  try {
    const token = await projectStore.createInvite(project.value.id, project.value.name)
    inviteLink.value = `${window.location.origin}/join/${token}`
  }
  finally {
    generating.value = false
  }
}

async function copyLink() {
  if (!inviteLink.value) return
  await navigator.clipboard.writeText(inviteLink.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

async function removeMember(memberUid: string) {
  if (!project.value) return
  removingUid.value = memberUid
  try {
    await projectStore.removeMember(project.value.id, memberUid)
  }
  finally {
    removingUid.value = null
  }
}

watch(open, (v) => {
  if (!v) {
    inviteLink.value = null
    copied.value = false
  }
})
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-share-variant-outline" />
        Share "{{ project?.name }}"
      </v-card-title>

      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Anyone with the link can join as an editor. Links expire in 7 days.
        </p>

        <!-- Generate / show link -->
        <div v-if="!inviteLink" class="mb-4">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-link-plus"
            :loading="generating"
            @click="generateLink"
          >
            Generate invite link
          </v-btn>
        </div>

        <div v-else class="mb-4">
          <v-text-field
            :model-value="inviteLink"
            readonly
            variant="outlined"
            density="compact"
            hide-details
            class="mb-2"
          >
            <template #append-inner>
              <v-btn
                :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
                :color="copied ? 'success' : undefined"
                variant="text"
                size="small"
                @click="copyLink"
              />
            </template>
          </v-text-field>
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-refresh"
            class="text-none"
            :loading="generating"
            @click="inviteLink = null"
          >
            Generate new link
          </v-btn>
        </div>

        <!-- Current members -->
        <v-divider class="mb-3" />
        <div class="text-caption text-medium-emphasis text-uppercase mb-2">Members</div>

        <v-list density="compact" class="pa-0">
          <!-- Owner row -->
          <v-list-item
            prepend-icon="mdi-account-circle-outline"
            :subtitle="project?.uid"
          >
            <template #title>
              <span class="text-body-2">You (owner)</span>
            </template>
            <template #append>
              <v-chip size="x-small" color="primary" variant="tonal">Owner</v-chip>
            </template>
          </v-list-item>

          <v-list-item
            v-for="m in members"
            :key="m.uid"
            prepend-icon="mdi-account-outline"
          >
            <template #title>
              <span class="text-body-2">{{ m.displayName || m.email || m.uid }}</span>
            </template>
            <template #subtitle>
              <span v-if="m.displayName && m.email" class="text-caption text-medium-emphasis">{{ m.email }}</span>
            </template>
            <template #append>
              <v-chip size="x-small" color="secondary" variant="tonal" class="mr-2">Editor</v-chip>
              <v-btn
                icon="mdi-account-remove-outline"
                variant="text"
                size="small"
                color="error"
                :loading="removingUid === m.uid"
                @click="removeMember(m.uid)"
              />
            </template>
          </v-list-item>

          <v-list-item v-if="members.length === 0" class="text-medium-emphasis text-body-2">
            No members yet.
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
