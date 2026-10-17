<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { fields } from './fields'
import type { DataSample } from './samples'
const props = defineProps<{
  modelValue: string
  samples: DataSample[]
  label: string
  arraysOnly?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const search = ref('')
const id = useId()
const options = computed(() =>
  props.samples.flatMap((sample) =>
    fields(sample.value, sample.path)
      .filter(
        (field) =>
          (!props.arraysOnly || field.type === 'array') &&
          field.path.toLowerCase().includes(search.value.toLowerCase()),
      )
      .map((field) => ({ ...field, source: sample.label })),
  ),
)
function choose(path: string, event: Event) {
  emit('update:modelValue', path)
  const details = (event.currentTarget as HTMLElement).closest('details')
  if (details) {
    details.open = false
    details.querySelector('summary')?.focus()
  }
}
</script>
<template>
  <div class="lu-field-picker">
    <input
      :value="modelValue"
      :aria-label="label"
      placeholder="/response/items"
      maxlength="160"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <details>
      <summary :aria-label="`选择${label}`">选择字段</summary>
      <div class="lu-field-menu">
        <input v-model="search" :aria-label="`搜索${label}`" placeholder="搜索字段路径…" />
        <ul :id="id" :aria-label="label">
          <li v-for="(field, index) in options" :key="`${field.source}-${index}`">
            <button
              type="button"
              :style="{ paddingInlineStart: `${10 + field.depth * 10}px` }"
              @click="choose(field.path, $event)"
            >
              <code>{{ field.path }}</code
              ><span>{{
                field.type === 'array'
                  ? `数组 · ${(field.value as unknown[]).length} 项`
                  : field.type
              }}</span
              ><small>{{ field.source }}</small>
            </button>
          </li>
          <li v-if="!options.length" class="lu-muted">
            没有匹配字段。可手动填写路径，或在接口中补充返回示例。
          </li>
        </ul>
      </div>
    </details>
  </div>
</template>
