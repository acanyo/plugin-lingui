<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { normalizeHex } from './theme-fields'
const props = defineProps<{ modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; validity: [valid: boolean] }>()
const id = useId(),
  draft = ref(props.modelValue),
  invalid = ref(false)
watch(
  () => props.modelValue,
  (value) => {
    draft.value = value
    invalid.value = false
    emit('validity', true)
  },
)
function update(value: string, format = false) {
  draft.value = value
  const normalized = normalizeHex(value)
  invalid.value = !normalized
  emit('validity', Boolean(normalized))
  // Expand shorthand only on commit, so typing six digits is not interrupted at digit three.
  if (normalized && (format || /^#[\da-f]{6}$/i.test(value.trim()))) {
    emit('update:modelValue', normalized)
    if (format) draft.value = normalized
  }
}
</script>
<template>
  <div class="lu-theme-color-row">
    <label :for="id">{{ label }}</label>
    <div class="lu-theme-color-control" :class="{ invalid }">
      <input
        type="color"
        :value="modelValue"
        :aria-label="`选择${label}`"
        @input="update(($event.target as HTMLInputElement).value, true)"
      />
      <input
        :id="id"
        :value="draft"
        maxlength="7"
        spellcheck="false"
        autocomplete="off"
        :aria-label="`${label}色值`"
        :aria-invalid="invalid"
        :aria-describedby="invalid ? `${id}-error` : undefined"
        @input="update(($event.target as HTMLInputElement).value)"
        @blur="update(draft, true)"
        @keydown.enter.prevent="update(draft, true)"
      />
    </div>
    <span v-if="invalid" :id="`${id}-error`" class="lu-theme-color-error" role="alert"
      >请输入 #RGB 或 #RRGGBB 色值</span
    >
  </div>
</template>
