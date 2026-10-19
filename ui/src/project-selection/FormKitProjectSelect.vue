<script setup lang="ts">
import type { useFormKitContext } from '@formkit/vue'
import LinguiProjectSelect from './LinguiProjectSelect.vue'

type FormKitContext = NonNullable<ReturnType<typeof useFormKitContext<string>>['value']>
const props = defineProps<{
  context: FormKitContext & {
    category?: string
    publicOnly?: boolean
    clearable?: boolean
    placeholder?: string
    pageSize?: number
    showPreview?: boolean
  }
}>()

function update(value: string) {
  if (!props.context.disabled) props.context.node.input(value)
}
</script>

<template>
  <LinguiProjectSelect
    :id="`${context.id}-selection`"
    :model-value="typeof context._value === 'string' ? context._value : ''"
    :category="context.category"
    :public-only="context.publicOnly ?? true"
    :clearable="context.clearable ?? true"
    :disabled="!!context.disabled"
    :placeholder="context.placeholder"
    :page-size="context.pageSize"
    :show-preview="context.showPreview ?? false"
    @update:model-value="update"
  />
</template>
