<script setup lang="ts">
import type { InspirationItem, RoomType } from '~/models'
import { ROOM_TYPE_OPTIONS } from '~/config/rooms'
import { useResearch } from '~/composables/useResearch'
import { fetchOpenGraph } from '~/utils/og-fetch'
import { useInspirationOps } from '~/composables/useInspiration'

const props = defineProps<{ modelValue: boolean, defaultRoomType?: RoomType, item?: InspirationItem }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = useInspirationOps()
const { entries } = useResearch()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.item)

const url = ref('')
const title = ref('')
const imageUrl = ref('')
const notes = ref('')
const roomType = ref<RoomType>('kitchen')
const psychologyTags = ref<string[]>([])
const fetching = ref(false)
const fetched = ref(false)

watch(open, (v) => {
  if (!v) return
  const i = props.item
  url.value = i?.url ?? ''
  title.value = i?.title ?? ''
  imageUrl.value = i?.imageUrl ?? ''
  notes.value = i?.notes ?? ''
  roomType.value = i?.roomType ?? props.defaultRoomType ?? 'kitchen'
  psychologyTags.value = i ? [...i.psychologyTags] : []
  fetched.value = false
}, { immediate: true })

const tagItems = entries.map(e => ({ value: e.slug, title: e.title }))

const urlValid = computed(() => {
  try {
    return !!new URL(url.value.trim())
  }
  catch {
    return false
  }
})
const imageValid = computed(() => {
  const v = imageUrl.value.trim()
  if (!v) return true
  try {
    return !!new URL(v)
  }
  catch {
    return false
  }
})
const valid = computed(() => urlValid.value && !!title.value.trim() && imageValid.value)

async function lookup() {
  if (!urlValid.value) return
  fetching.value = true
  try {
    const og = await fetchOpenGraph(url.value.trim())
    if (og.title && !title.value.trim()) title.value = og.title
    if (og.imageUrl && !imageUrl.value.trim()) imageUrl.value = og.imageUrl
    fetched.value = true
  }
  finally {
    fetching.value = false
  }
}

function save() {
  if (!valid.value) return
  const fields = {
    roomType: roomType.value,
    title: title.value.trim(),
    url: url.value.trim(),
    psychologyTags: psychologyTags.value,
    ...(imageUrl.value.trim() ? { imageUrl: imageUrl.value.trim() } : {}),
    ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
  }
  if (props.item) {
    ops.save({
      id: props.item.id,
      uid: props.item.uid,
      projectId: props.item.projectId,
      ...(props.item.roomId ? { roomId: props.item.roomId } : {}),
      ...fields,
    })
  }
  else {
    ops.add(fields)
  }
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit inspiration' : 'Add inspiration by URL' }}</v-card-title>
      <v-card-text>
        <div class="d-flex ga-2 mb-2">
          <v-text-field
            v-model="url"
            label="URL"
            placeholder="https://…"
            density="comfortable"
            :error="!!url.trim() && !urlValid"
            hide-details
          />
          <v-btn :loading="fetching" :disabled="!urlValid" variant="tonal" @click="lookup">Fetch</v-btn>
        </div>
        <p v-if="fetched" class="text-caption text-medium-emphasis mb-2">
          If the fields didn't fill, the site blocked the fetch — enter them manually.
        </p>
        <v-text-field v-model="title" label="Title" density="comfortable" class="mb-2" :error="!title.trim()" />
        <v-text-field v-model="imageUrl" label="Image URL (optional)" density="comfortable" class="mb-2" :error="!imageValid" />
        <v-select v-model="roomType" :items="ROOM_TYPE_OPTIONS" label="Room type" density="comfortable" class="mb-2" />
        <v-text-field v-model="notes" label="Notes (optional)" density="comfortable" class="mb-2" />
        <v-select
          v-model="psychologyTags"
          :items="tagItems"
          label="Psychology tags (optional)"
          multiple
          chips
          closable-chips
          density="comfortable"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
