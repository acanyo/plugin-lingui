<script setup lang="ts">
import { ref } from 'vue'
import type { Action, LocalAction } from '@lingui/renderer'
const props = defineProps<{ action: Action }>()
const emit = defineEmits<{ update: [action: Action] }>()
const error = ref('')
const labels: Record<LocalAction['type'], string> = {
  setState: '设置值',
  toggleState: '切换开关',
  increment: '数值加一',
  decrement: '数值减一',
  selectOption: '选择值',
  show: '显示',
  hide: '隐藏',
  nextStep: '下一步',
  previousStep: '上一步',
  reset: '重置实例',
}
function update(index: number, item: LocalAction) {
  error.value = ''
  emit('update', {
    functionCall: {
      call: 'lingui.dispatch',
      args: {
        actions: props.action.functionCall.args.actions.map((action, i) =>
          i === index ? item : action,
        ),
      },
    },
  })
}
function type(index: number, value: LocalAction['type']) {
  update(
    index,
    value === 'reset'
      ? { type: value }
      : {
          type: value,
          path: props.action.functionCall.args.actions[index]?.path ?? '/value',
          ...(value === 'setState' || value === 'selectOption' ? { value: '' } : {}),
        },
  )
}
function value(index: number, field: HTMLInputElement) {
  try {
    update(index, {
      ...props.action.functionCall.args.actions[index]!,
      value: JSON.parse(field.value),
    })
    field.setCustomValidity('')
  } catch {
    error.value = '动作值需要有效 JSON，例如 "完成"、true 或 1。'
    field.setCustomValidity(error.value)
  }
}
</script>
<template>
  <fieldset class="lu-table-editor" aria-label="本地动作配置">
    <legend>执行动作</legend>
    <div
      v-for="(action, index) in props.action.functionCall.args.actions"
      :key="index"
      class="lu-table-editor-row"
    >
      <label class="lu-field"
        ><span>动作类型</span
        ><select
          :value="action.type"
          @change="type(index, ($event.target as HTMLSelectElement).value as LocalAction['type'])"
        >
          <option v-for="(label, key) in labels" :key="key" :value="key">{{ label }}</option>
        </select></label
      >
      <label v-if="action.type !== 'reset'" class="lu-field"
        ><span>状态路径</span
        ><input
          :value="action.path"
          maxlength="160"
          @change="update(index, { ...action, path: ($event.target as HTMLInputElement).value })"
      /></label>
      <label v-if="['setState', 'selectOption'].includes(action.type)" class="lu-field"
        ><span>动作值（JSON）</span
        ><input
          :value="JSON.stringify(action.value)"
          @change="value(index, $event.target as HTMLInputElement)"
      /></label>
    </div>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
  </fieldset>
</template>
