<script setup lang="ts">
import { ref } from 'vue'
import { validateInstance, type ComponentInstance, type Parameter } from '@lingui/renderer'
const props = defineProps<{ instance: ComponentInstance }>()
const emit = defineEmits<{ update: [instance: ComponentInstance] }>()
const error = ref('')
function change(parameter: Parameter, event: Event) {
  const input = event.target as HTMLInputElement
  const value =
    parameter.type === 'boolean'
      ? input.checked
      : parameter.type === 'number'
        ? Number(input.value)
        : input.value
  try {
    emit(
      'update',
      validateInstance({
        ...props.instance,
        parameters: { ...props.instance.parameters, [parameter.key]: value },
      }),
    )
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '参数无效'
  }
}
</script>
<template>
  <section class="lu-instance-parameters">
    <h3>当前实例参数</h3>
    <p class="lu-muted">填写当前组件使用的值，文章与模板分别保存。</p>
    <p v-if="!instance.document.parameters.length" class="lu-muted">尚未定义参数，可在下方添加。</p>
    <label v-for="parameter in instance.document.parameters" :key="parameter.key" class="lu-field">
      <span>{{ parameter.label }}</span>
      <input
        v-if="parameter.type === 'boolean'"
        type="checkbox"
        :aria-label="parameter.label"
        :checked="Boolean(instance.parameters[parameter.key] ?? parameter.default)"
        @change="change(parameter, $event)"
      />
      <input
        v-else
        :type="parameter.type === 'number' ? 'number' : 'text'"
        :aria-label="parameter.label"
        :value="instance.parameters[parameter.key] ?? parameter.default"
        :min="parameter.min"
        :max="parameter.max"
        @change="change(parameter, $event)"
      />
    </label>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
  </section>
</template>
