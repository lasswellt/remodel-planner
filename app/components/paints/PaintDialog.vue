<script setup lang="ts">
import type { Paint, PaintFinish, PaintSurface, Room } from '~/models'
import { PAINT_BRAND_SUGGESTIONS, PAINT_FINISH_OPTIONS, PAINT_SURFACE_OPTIONS } from '~/config/paints'
import { usePaintOps, type NewPaintFields } from '~/composables/usePaints'

const props = defineProps<{ modelValue: boolean, room: Room, paint?: Paint }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const ops = usePaintOps()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => !!props.paint)

const name = ref('')
const brand = ref('')
const code = ref('')
const finish = ref<PaintFinish | null>(null)
const surface = ref<PaintSurface | null>(null)
const hex = ref('')
const notes = ref('')

watch(open, (v) => {
  if (!v) return
  const p = props.paint
  name.value = p?.name ?? ''
  brand.value = p?.brand ?? ''
  code.value = p?.code ?? ''
  finish.value = p?.finish ?? null
  surface.value = p?.surface ?? null
  hex.value = p?.hex ?? ''
  notes.value = p?.notes ?? ''
}, { immediate: true })

const hexValid = computed(() => !hex.value.trim() || /^#[0-9a-fA-F]{6}$/.test(hex.value.trim()))
const valid = computed(() => !!name.value.trim() && hexValid.value)
const swatchValue = computed(() => (hexValid.value && hex.value.trim() ? hex.value.trim() : '#cccccc'))

function onSwatchInput(e: Event) {
  hex.value = (e.target as HTMLInputElement).value
}

function save() {
  if (!valid.value) return
  const fields: NewPaintFields = {
    name: name.value.trim(),
    ...(brand.value.trim() ? { brand: brand.value.trim() } : {}),
    ...(code.value.trim() ? { code: code.value.trim() } : {}),
    ...(finish.value ? { finish: finish.value } : {}),
    ...(surface.value ? { surface: surface.value } : {}),
    ...(hex.value.trim() ? { hex: hex.value.trim().toLowerCase() } : {}),
    ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
  }
  if (props.paint) {
    ops.save({
      id: props.paint.id,
      uid: props.paint.uid,
      projectId: props.paint.projectId,
      roomId: props.paint.roomId,
      ...fields,
    })
  }
  else {
    ops.add(props.room.id, fields)
  }
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit color' : 'Add paint color' }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="name"
          label="Color name"
          placeholder="e.g. Sea Salt"
          density="comfortable"
          autofocus
          class="mb-2"
          :error="!name.trim()"
        />
        <div class="d-flex ga-2">
          <v-combobox v-model="brand" :items="PAINT_BRAND_SUGGESTIONS" label="Brand (optional)" density="comfortable" class="mb-2" />
          <v-text-field v-model="code" label="Color code (optional)" placeholder="e.g. SW 6204" density="comfortable" class="mb-2" />
        </div>
        <div class="d-flex ga-2">
          <v-select v-model="finish" :items="PAINT_FINISH_OPTIONS" label="Finish (optional)" clearable density="comfortable" class="mb-2" />
          <v-select v-model="surface" :items="PAINT_SURFACE_OPTIONS" label="Surface (optional)" clearable density="comfortable" class="mb-2" />
        </div>
        <div class="d-flex ga-3 align-center mb-2">
          <label class="swatch-input" :style="{ background: swatchValue }">
            <input type="color" :value="swatchValue" aria-label="Pick swatch color" @input="onSwatchInput">
          </label>
          <v-text-field
            v-model="hex"
            label="Hex swatch (optional)"
            placeholder="#a8b0a0"
            density="comfortable"
            hide-details
            :error="!hexValid"
            class="flex-grow-1"
          />
        </div>
        <v-text-field v-model="notes" label="Notes (optional)" density="comfortable" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.swatch-input {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  cursor: pointer;
  overflow: hidden;
  flex: 0 0 auto;
}
.swatch-input input {
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
</style>
