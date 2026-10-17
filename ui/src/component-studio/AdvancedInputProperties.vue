<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  readPath,
  type ComponentNode,
  type JsonValue,
  type LinguiDocument,
  type State,
} from '@lingui/renderer'
import { updateBoundValue } from './value-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ update: [node: ComponentNode]; document: [document: LinguiDocument] }>()
const error = ref('')
const controls = [
  'LingUI.SearchInput',
  'LingUI.ColorPicker',
  'LingUI.MultiSelect',
  'LingUI.TagInput',
  'LingUI.Pagination',
]
const value = computed(() =>
  props.node.value && typeof props.node.value === 'object' && 'path' in props.node.value
    ? readPath(props.state, props.node.value.path)
    : props.node.value,
)
const selected = computed(() =>
  Array.isArray(value.value)
    ? value.value.filter((item): item is string => typeof item === 'string')
    : [],
)
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
function set(next: JsonValue) {
  error.value = ''
  if (props.node.value && typeof props.node.value === 'object' && 'path' in props.node.value)
    emit('document', updateBoundValue(props.document, props.node, next))
  else patch('value', next)
}
function color(text: string) {
  if (/^#[0-9a-f]{6}$/i.test(text)) set(text.toLowerCase())
  else error.value = '请输入六位十六进制颜色，例如 #2563eb。'
}
function tags(text: string) {
  const tags = text
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
  if (
    tags.length > (props.node.maxTags ?? 10) ||
    tags.some((tag) => tag.length > 80) ||
    new Set(tags).size !== tags.length
  ) {
    error.value = '标签不能重复，每项最多 80 字，且不能超过数量上限。'
    return
  }
  set(tags)
}
function choose(option: string, checked: boolean) {
  const next = checked
    ? [...selected.value, option]
    : selected.value.filter((item) => item !== option)
  if (next.length > (props.node.maxSelected ?? 40)) {
    error.value = '初始选择不能超过数量上限。'
    return
  }
  set(next)
}
function integer(key: string, text: string, maximum: number) {
  const value = Number(text)
  if (Number.isInteger(value) && value >= 1 && value <= maximum) patch(key, value)
}
</script>
<template>
  <template v-if="controls.includes(node.component)">
    <label
      v-if="
        ['LingUI.ColorPicker', 'LingUI.Pagination'].includes(node.component) &&
        typeof node.disabled !== 'object'
      "
      class="lu-check"
      ><input
        type="checkbox"
        :checked="Boolean(node.disabled)"
        @change="patch('disabled', ($event.target as HTMLInputElement).checked)"
      />禁用交互</label
    >
    <label v-if="node.component === 'LingUI.TagInput'" class="lu-field"
      ><span>输入提示</span
      ><input
        :value="node.placeholder ?? ''"
        @change="patch('placeholder', ($event.target as HTMLInputElement).value)"
    /></label>
    <label v-if="node.component === 'LingUI.SearchInput'" class="lu-field"
      ><span>初始关键词</span
      ><input
        :value="value"
        :maxlength="node.maxLength ?? 500"
        @change="set(($event.target as HTMLInputElement).value)"
    /></label>
    <label v-if="node.component === 'LingUI.ColorPicker'" class="lu-field"
      ><span>初始颜色</span
      ><input
        :value="value"
        maxlength="7"
        @change="color(($event.target as HTMLInputElement).value)"
    /></label>
    <template v-if="node.component === 'LingUI.MultiSelect'">
      <label class="lu-field"
        ><span>最多选择（1–40）</span
        ><input
          type="number"
          min="1"
          max="40"
          :value="node.maxSelected ?? 40"
          @change="integer('maxSelected', ($event.target as HTMLInputElement).value, 40)"
      /></label>
      <fieldset class="lu-value-options">
        <legend>初始选项</legend>
        <label v-for="option in node.options" :key="option.value" class="lu-check"
          ><input
            type="checkbox"
            :checked="selected.includes(option.value)"
            @change="choose(option.value, ($event.target as HTMLInputElement).checked)"
          />{{ option.label }}</label
        >
      </fieldset>
    </template>
    <template v-if="node.component === 'LingUI.TagInput'">
      <label class="lu-field"
        ><span>最多标签（1–20）</span
        ><input
          type="number"
          min="1"
          max="20"
          :value="node.maxTags ?? 10"
          @change="integer('maxTags', ($event.target as HTMLInputElement).value, 20)"
      /></label>
      <label class="lu-field"
        ><span>初始标签（每行一项）</span
        ><textarea
          rows="4"
          :value="selected.join('\n')"
          @change="tags(($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </template>
    <template v-if="node.component === 'LingUI.Pagination'">
      <label class="lu-field"
        ><span>总页数</span
        ><input
          type="number"
          min="1"
          max="10000"
          :value="node.totalPages"
          @change="integer('totalPages', ($event.target as HTMLInputElement).value, 10000)"
      /></label>
      <label class="lu-field"
        ><span>初始页码</span
        ><input
          type="number"
          min="1"
          :max="node.totalPages"
          :value="value"
          @change="
            set(
              Math.max(
                1,
                Math.min(
                  node.totalPages ?? 1,
                  Math.round(Number(($event.target as HTMLInputElement).value) || 1),
                ),
              ),
            )
          "
      /></label>
      <p class="lu-muted">分页只更新本地页码。可用条件显示组合各页内容。</p>
    </template>
  </template>
  <template v-if="node.component === 'LingUI.Alert'">
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="node.dismissible"
        @change="patch('dismissible', ($event.target as HTMLInputElement).checked)"
      />允许关闭</label
    >
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="value !== false"
        @change="set(($event.target as HTMLInputElement).checked)"
      />初始显示</label
    >
  </template>
  <label v-if="['LingUI.Alert', 'LingUI.Status'].includes(node.component)" class="lu-field"
    ><span>语义状态</span
    ><select
      :value="node.tone ?? 'info'"
      @change="patch('tone', ($event.target as HTMLSelectElement).value)"
    >
      <option value="info">信息</option>
      <option value="success">成功</option>
      <option value="warning">提醒</option>
      <option value="danger">错误</option>
    </select></label
  >
  <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
</template>
<style scoped>
.lu-value-options {
  border: 1px solid var(--lu-border, #e5e7eb);
  border-radius: 8px;
  padding: 12px;
  margin: 0 0 12px;
  min-width: 0;
}
.lu-value-options legend {
  font-size: 12px;
  padding: 0 4px;
}
</style>
