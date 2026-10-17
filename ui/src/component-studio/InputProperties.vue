<script setup lang="ts">
import type { ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
function mode(date: boolean, time: boolean) {
  const { min, max, ...node } = props.node
  emit('update', { ...node, enableDate: date, enableTime: time })
}
function bound(key: 'min' | 'max', value: string) {
  if (value) patch(key, value)
  else {
    const node = { ...props.node }
    delete node[key]
    emit('update', node)
  }
}
</script>
<template>
  <label
    v-if="
      [
        'LingUI.Switch',
        'LingUI.SegmentedControl',
        'LingUI.Rating',
        'LingUI.TreeView',
        'LingUI.Calendar',
        'LingUI.CardChoice',
        'LingUI.CheckboxGroup',
        'LingUI.Kanban',
        'LingUI.FormGroup',
      ].includes(node.component) && typeof node.disabled !== 'object'
    "
    class="lu-check"
    ><input
      type="checkbox"
      :checked="Boolean(node.disabled)"
      @change="patch('disabled', ($event.target as HTMLInputElement).checked)"
    />禁用交互</label
  >
  <template v-if="node.component === 'LingUI.Rating'">
    <label class="lu-field"
      ><span>最多星数</span
      ><input
        type="number"
        min="1"
        max="10"
        :value="node.max ?? 5"
        @change="
          patch(
            'max',
            Math.max(
              1,
              Math.min(10, Math.round(Number(($event.target as HTMLInputElement).value) || 5)),
            ),
          )
        "
    /></label>
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="node.readOnly"
        @change="patch('readOnly', ($event.target as HTMLInputElement).checked)"
      />只读展示</label
    >
  </template>
  <label v-if="node.component === 'TextField'" class="lu-field"
    ><span>输入类型</span
    ><select
      :value="node.variant ?? 'shortText'"
      @change="patch('variant', ($event.target as HTMLSelectElement).value)"
    >
      <option value="shortText">单行文本</option>
      <option value="longText">多行文本</option>
      <option value="number">数字文本</option>
      <option value="obscured">隐藏文本</option>
    </select></label
  >
  <template v-if="node.component === 'DateTimeInput'">
    <label class="lu-field"
      ><span>选择内容</span
      ><select
        :value="node.enableDate && node.enableTime ? 'both' : node.enableTime ? 'time' : 'date'"
        @change="
          mode(
            ($event.target as HTMLSelectElement).value !== 'time',
            ($event.target as HTMLSelectElement).value !== 'date',
          )
        "
      >
        <option value="date">日期</option>
        <option value="time">时间</option>
        <option value="both">日期与时间</option>
      </select></label
    >
    <label v-for="key in ['min', 'max'] as const" :key="key" class="lu-field"
      ><span>{{ key === 'min' ? '最早可选值' : '最晚可选值' }}</span
      ><input
        :type="
          node.enableDate && node.enableTime ? 'datetime-local' : node.enableTime ? 'time' : 'date'
        "
        :value="node[key]"
        @change="bound(key, ($event.target as HTMLInputElement).value)"
    /></label>
  </template>
</template>
