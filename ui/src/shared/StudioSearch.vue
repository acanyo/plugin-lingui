<script setup lang="ts">
import { ref } from 'vue'
import LinguiIcon from './LinguiIcon.vue'
withDefaults(
  defineProps<{ label: string; placeholder?: string; maxlength?: number; disabled?: boolean }>(),
  {
    maxlength: 120,
  },
)
const value = defineModel<string>({ required: true })
const input = ref<HTMLInputElement>()
function clear() {
  value.value = ''
  input.value?.focus()
}
</script>
<template>
  <label class="lu-search-field">
    <LinguiIcon name="search" />
    <input
      ref="input"
      v-model="value"
      type="search"
      name="query"
      autocomplete="off"
      :spellcheck="false"
      :aria-label="label"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :disabled="disabled"
    />
    <button
      v-if="value"
      type="button"
      class="lu-search-clear"
      :aria-label="`清空${label}`"
      :disabled="disabled"
      @click.prevent="clear"
    >
      <LinguiIcon name="close" />
    </button>
  </label>
</template>
