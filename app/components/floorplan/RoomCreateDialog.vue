<script setup lang="ts">
import type { Geometry, RoomType } from '~/models'
import { ROOM_TYPE_OPTIONS } from '~/config/rooms'
import { sqFt } from '~/utils/geometry'

// Names + types a freshly drawn rect. Kept deliberately small: two fields and
// one primary action (UX5); cancel discards the drawn rect.
const props = defineProps<{
  geometry: Geometry | null
  defaultName: string
}>()

const emit = defineEmits<{
  confirm: [data: { name: string, type: RoomType }]
  cancel: []
}>()

const open = defineModel<boolean>({ default: false })

const name = ref('')
const type = ref<RoomType>('bedroom')
const confirmed = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = props.defaultName
    type.value = 'bedroom'
    confirmed.value = false
  }
})

const valid = computed(() => name.value.trim().length > 0)

function confirm() {
  if (!valid.value) return
  confirmed.value = true
  open.value = false
  emit('confirm', { name: name.value.trim(), type: type.value })
}

function cancel() {
  open.value = false
}
</script>

<template>
  <!-- Any non-confirm close (button, Esc, outside click) discards the rect. -->
  <v-dialog v-model="open" max-width="420" @after-leave="!confirmed && emit('cancel')">
    <v-card>
      <v-card-title>New room</v-card-title>
      <v-card-subtitle v-if="geometry">
        {{ sqFt(geometry) }} sq ft on the plan
      </v-card-subtitle>
      <v-card-text>
        <v-form @submit.prevent="confirm">
          <v-text-field
            v-model="name"
            label="Room name"
            autofocus
            :rules="[(v: string) => !!v.trim() || 'Name the room']"
          />
          <v-select
            v-model="type"
            :items="ROOM_TYPE_OPTIONS"
            :item-props="(item: typeof ROOM_TYPE_OPTIONS[number]) => ({ prependIcon: item.icon })"
            label="Room type"
            class="mt-2"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="confirm">Add room</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
