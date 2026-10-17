<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  readPath,
  type ComponentNode,
  type LinguiDocument,
  type State,
  type JsonValue,
} from '@lingui/renderer'
import {
  dateRange,
  dateRangeError,
  numberRange,
} from '../../../packages/renderer/src/renderer-core/inputs/ranges'
import { dateInputValue } from '../../../packages/renderer/src/protocol/date-time'
import { updateBoundValue } from './value-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ update: [node: ComponentNode]; document: [document: LinguiDocument] }>()
const error = ref('')
const supported = [
  'LingUI.RangeSlider',
  'LingUI.DateRange',
  'LingUI.NumberStepper',
  'LingUI.PasswordInput',
  'LingUI.Combobox',
  'LingUI.Transfer',
  'LingUI.ToggleButton',
]
const value = computed(() =>
  props.node.value && typeof props.node.value === 'object' && 'path' in props.node.value
    ? readPath(props.state, props.node.value.path)
    : props.node.value,
)
const numericRange = computed(() =>
  numberRange(value.value, Number(props.node.min), Number(props.node.max)),
)
const dates = computed(() => dateRange(value.value))
const selected = computed(() =>
  Array.isArray(value.value)
    ? value.value.filter((item): item is string => typeof item === 'string')
    : [],
)
function patch(key: string, value: unknown) {
  error.value = ''
  emit('update', { ...props.node, [key]: value })
}
function set(value: JsonValue) {
  error.value = ''
  try {
    emit('document', updateBoundValue(props.document, props.node, value))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '初始值无效'
  }
}
function bound(key: 'min' | 'max' | 'step', text: string) {
  const value = Number(text),
    next = { ...props.node, [key]: value }
  if (
    !text.trim() ||
    !Number.isFinite(value) ||
    Math.abs(value) > 1e12 ||
    (key === 'step' && value <= 0) ||
    Number(next.min) > Number(next.max) ||
    (next.component === 'LingUI.RangeSlider' && Number(next.min) === Number(next.max))
  ) {
    error.value = '请输入有效的范围和正数步长；范围上限应大于下限。'
    return
  }
  patch(key, value)
}
function number(text: string, key?: 'start' | 'end') {
  const value = Number(text),
    min = Number(props.node.min),
    max = Number(props.node.max)
  if (!text.trim() || !Number.isFinite(value) || value < min || value > max) {
    error.value = '初始数值必须在范围内。'
    return
  }
  if (!key) {
    set(value)
    return
  }
  const next = { ...numericRange.value, [key]: value }
  if (next.start > next.end) {
    error.value = '区间上限不能小于下限。'
    return
  }
  set(next)
}
function date(key: 'start' | 'end', text: string) {
  if (text && !dateInputValue(text, true, false)) {
    error.value = '请输入有效日期。'
    return
  }
  const next = { ...dates.value, [key]: text },
    problem = dateRangeError(next, props.node.min as string, props.node.max as string)
  if (problem) {
    error.value = problem
    return
  }
  set(next)
}
function dateBound(key: 'min' | 'max', text: string) {
  const next = { ...props.node }
  if (text) next[key] = text
  else delete next[key]
  if (
    (text && !dateInputValue(text, true, false)) ||
    (next.min && next.max && next.min > next.max)
  ) {
    error.value = '日期上下限无效。'
    return
  }
  error.value = ''
  emit('update', next)
}
function select(option: string, checked: boolean) {
  set(
    checked
      ? [...new Set([...selected.value, option])]
      : selected.value.filter((item) => item !== option),
  )
}
</script>
<template>
  <template v-if="supported.includes(node.component)">
    <label v-if="typeof node.disabled !== 'object'" class="lu-check"
      ><input
        type="checkbox"
        :checked="Boolean(node.disabled)"
        @change="patch('disabled', ($event.target as HTMLInputElement).checked)"
      />禁用交互</label
    >
    <template v-if="['LingUI.RangeSlider', 'LingUI.NumberStepper'].includes(node.component)">
      <label v-for="key in ['min', 'max', 'step'] as const" :key="key" class="lu-field"
        ><span>{{ { min: '数值下限', max: '数值上限', step: '步长' }[key] }}</span
        ><input
          type="number"
          step="any"
          :value="node[key] ?? 1"
          @change="bound(key, ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-field"
        ><span>数值单位</span
        ><input
          :value="node.unit ?? ''"
          maxlength="40"
          @change="patch('unit', ($event.target as HTMLInputElement).value)"
      /></label>
      <label v-if="node.component === 'LingUI.NumberStepper'" class="lu-field"
        ><span>初始数值</span
        ><input
          type="number"
          step="any"
          :value="value"
          @change="number(($event.target as HTMLInputElement).value)"
      /></label>
      <template v-else
        ><label v-for="key in ['start', 'end'] as const" :key="key" class="lu-field"
          ><span>{{ key === 'start' ? '初始下限' : '初始上限' }}</span
          ><input
            type="number"
            step="any"
            :value="numericRange[key]"
            @change="number(($event.target as HTMLInputElement).value, key)" /></label
      ></template>
    </template>
    <template v-if="node.component === 'LingUI.DateRange'">
      <label v-for="key in ['min', 'max'] as const" :key="key" class="lu-field"
        ><span>{{ key === 'min' ? '最早日期（可选）' : '最晚日期（可选）' }}</span
        ><input
          type="date"
          :value="node[key]"
          @change="dateBound(key, ($event.target as HTMLInputElement).value)"
      /></label>
      <label v-for="key in ['start', 'end'] as const" :key="key" class="lu-field"
        ><span>{{ key === 'start' ? '初始开始日期' : '初始结束日期' }}</span
        ><input
          type="date"
          :value="dates[key]"
          @change="date(key, ($event.target as HTMLInputElement).value)"
      /></label>
    </template>
    <label
      v-if="['LingUI.PasswordInput', 'LingUI.Combobox'].includes(node.component)"
      class="lu-field"
      ><span>输入提示</span
      ><input
        :value="node.placeholder ?? ''"
        @change="patch('placeholder', ($event.target as HTMLInputElement).value)"
    /></label>
    <template v-if="node.component === 'LingUI.PasswordInput'"
      ><label class="lu-field"
        ><span>最多字符（1–500）</span
        ><input
          type="number"
          min="1"
          max="500"
          :value="node.maxLength ?? 120"
          @change="
            Number.isInteger(Number(($event.target as HTMLInputElement).value)) &&
            Number(($event.target as HTMLInputElement).value) >= 1 &&
            Number(($event.target as HTMLInputElement).value) <= 500 &&
            patch('maxLength', Number(($event.target as HTMLInputElement).value))
          "
      /></label>
      <p class="lu-muted">
        初始内容保持为空。此组件用于交互演示，请勿输入真实密码或密钥。
      </p></template
    >
    <label v-if="node.component === 'LingUI.Combobox'" class="lu-field"
      ><span>初始选项</span
      ><select
        aria-label="初始选项"
        :value="value"
        @change="set(($event.target as HTMLSelectElement).value)"
      >
        <option value="">未选择</option>
        <option v-for="option in node.options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select></label
    >
    <template v-if="node.component === 'LingUI.Transfer'"
      ><label v-for="key in ['sourceLabel', 'targetLabel'] as const" :key="key" class="lu-field"
        ><span>{{ key === 'sourceLabel' ? '待选标题' : '已选标题' }}</span
        ><input
          :value="node[key] ?? ''"
          @change="patch(key, ($event.target as HTMLInputElement).value)"
      /></label>
      <fieldset class="lu-table-editor">
        <legend>初始已选</legend>
        <label v-for="option in node.options" :key="option.value" class="lu-check"
          ><input
            type="checkbox"
            :checked="selected.includes(option.value)"
            @change="select(option.value, ($event.target as HTMLInputElement).checked)"
          />{{ option.label }}</label
        >
      </fieldset></template
    >
    <label v-if="node.component === 'LingUI.ToggleButton'" class="lu-check"
      ><input
        type="checkbox"
        :checked="value === true"
        @change="set(($event.target as HTMLInputElement).checked)"
      />初始选中</label
    >
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
  </template>
</template>
