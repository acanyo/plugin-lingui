<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentName, ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
type Field = {
  key:
    | 'padding'
    | 'gap'
    | 'direction'
    | 'align'
    | 'justify'
    | 'variant'
    | 'maxWidth'
    | 'minHeight'
    | 'size'
    | 'orientation'
    | 'placement'
    | 'tone'
  label: string
  initial: string | number
  options: [string | number, string][]
}
const scales: Field['options'] = [
  ['none', '无'],
  ['small', '小'],
  ['medium', '中'],
  ['large', '大'],
]
const directions: Field['options'] = [
  ['horizontal', '水平'],
  ['vertical', '垂直'],
]
const fields: Partial<Record<ComponentName, Field[]>> = {
  'LingUI.Box': [
    {
      key: 'variant',
      label: '容器外观',
      initial: 'plain',
      options: [
        ['plain', '透明'],
        ['outlined', '边框'],
        ['soft', '柔和背景'],
      ],
    },
    { key: 'padding', label: '内边距', initial: 'medium', options: scales },
    { key: 'gap', label: '子组件间距', initial: 'medium', options: scales },
    { key: 'direction', label: '排列方向', initial: 'vertical', options: directions },
    {
      key: 'align',
      label: '交叉轴对齐',
      initial: 'stretch',
      options: [
        ['start', '起始'],
        ['center', '居中'],
        ['end', '末尾'],
        ['stretch', '拉伸'],
      ],
    },
    {
      key: 'justify',
      label: '主轴对齐',
      initial: 'start',
      options: [
        ['start', '起始'],
        ['center', '居中'],
        ['end', '末尾'],
        ['spaceBetween', '两端'],
      ],
    },
  ],
  'LingUI.Center': [
    {
      key: 'maxWidth',
      label: '最大内容宽度',
      initial: 640,
      options: [320, 480, 640, 960].map((value) => [value, `${value} px`]),
    },
    {
      key: 'minHeight',
      label: '最小高度',
      initial: 0,
      options: [0, 120, 240, 360].map((value) => [value, value ? `${value} px` : '跟随内容']),
    },
  ],
  'LingUI.Spacer': [
    { key: 'size', label: '留白大小', initial: 'medium', options: scales },
    { key: 'direction', label: '留白方向', initial: 'vertical', options: directions },
  ],
  'LingUI.Separator': [
    { key: 'orientation', label: '分隔线方向', initial: 'horizontal', options: directions },
  ],
  'LingUI.ButtonGroup': [
    { key: 'direction', label: '按钮排列方向', initial: 'horizontal', options: directions },
    { key: 'gap', label: '按钮间距', initial: 'small', options: scales },
  ],
  'LingUI.Popover': [
    {
      key: 'placement',
      label: '浮层优先位置',
      initial: 'bottom',
      options: [
        ['bottom', '触发器下方'],
        ['top', '触发器上方'],
      ],
    },
  ],
  'LingUI.Highlight': [
    {
      key: 'tone',
      label: '高亮语义',
      initial: 'accent',
      options: [
        ['accent', '主题色'],
        ['success', '成功'],
        ['warning', '提示'],
        ['danger', '错误'],
      ],
    },
  ],
}
const settings = computed(() => fields[props.node.component] ?? [])
function change(field: Field, text: string) {
  const option = field.options.find(([value]) => String(value) === text)
  if (option) emit('update', { ...props.node, [field.key]: option[0] })
}
</script>
<template>
  <label v-for="field in settings" :key="field.key" class="lu-field">
    <span>{{ field.label }}</span>
    <select
      :aria-label="field.label"
      :value="node[field.key] ?? field.initial"
      @change="change(field, ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="[value, label] in field.options" :key="value" :value="value">
        {{ label }}
      </option>
    </select>
  </label>
  <p
    v-if="node.component === 'LingUI.Box' || node.component === 'LingUI.ButtonGroup'"
    class="lu-muted"
  >
    在结构树中选中此容器，即可继续添加和移动子组件。间距按作品主题缩放。
  </p>
  <p
    v-if="['LingUI.Center', 'LingUI.FormGroup', 'LingUI.Popover'].includes(node.component)"
    class="lu-muted"
  >
    选择结构树中的内容区，组合现有组件。
  </p>
  <p v-if="node.component === 'LingUI.Popover'" class="lu-muted">
    浮层打开时保留已有输入，支持点击外部或按 Esc 收起。
  </p>
</template>
