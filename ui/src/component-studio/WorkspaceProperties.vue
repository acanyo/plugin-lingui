<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  readPath,
  type ComponentNode,
  type LinguiDocument,
  type State,
  type JsonValue,
} from '@lingui/renderer'
import { dateInputValue } from '../../../packages/renderer/src/protocol/date-time'
import { updateBoundValue } from './value-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ update: [node: ComponentNode]; document: [document: LinguiDocument] }>()
const error = ref('')
const value = computed(() =>
  props.node.value && typeof props.node.value === 'object' && 'path' in props.node.value
    ? readPath(props.state, props.node.value.path)
    : props.node.value,
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
function date(text: string) {
  if (text && !dateInputValue(text, true, false)) {
    error.value = '请选择有效日期。'
    return
  }
  set(text)
}
function month(text: string) {
  if (!dateInputValue(`${text}-01`, true, false) || text.startsWith('0000')) {
    error.value = '请选择有效月份。'
    return
  }
  patch('month', text)
}
function toggle(id: string, checked: boolean) {
  const selected = new Set(
    Array.isArray(value.value)
      ? value.value.filter((value): value is string => typeof value === 'string')
      : [],
  )
  if (checked) selected.add(id)
  else selected.delete(id)
  set([...selected])
}
</script>
<template>
  <template v-if="node.component === 'LingUI.Calendar'">
    <label class="lu-field"
      ><span>默认显示月份</span
      ><input
        aria-label="默认显示月份"
        type="month"
        :value="node.month"
        @change="month(($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-field"
      ><span>初始日期</span
      ><input
        aria-label="初始日期"
        type="date"
        :value="typeof value === 'string' ? value : ''"
        @change="date(($event.target as HTMLInputElement).value)"
    /></label>
    <p class="lu-muted">有初始日期时优先显示该日期所在月份；留空时显示默认月份。</p>
  </template>
  <fieldset v-if="node.component === 'LingUI.CheckboxGroup'" class="lu-field">
    <legend>初始选择</legend>
    <label v-for="option in node.options" :key="option.value" class="lu-check"
      ><input
        type="checkbox"
        :checked="Array.isArray(value) && value.includes(option.value)"
        @change="toggle(option.value, ($event.target as HTMLInputElement).checked)"
      />{{ option.label }}</label
    >
  </fieldset>
  <label v-if="node.component === 'LingUI.Drawer'" class="lu-field"
    ><span>打开方向</span
    ><select
      aria-label="抽屉打开方向"
      :value="node.side ?? 'right'"
      @change="patch('side', ($event.target as HTMLSelectElement).value)"
    >
      <option value="right">右侧</option>
      <option value="left">左侧</option>
    </select></label
  >
  <template v-if="node.component === 'LingUI.SplitPane'">
    <label class="lu-field"
      ><span>左栏初始占比（20–80）</span
      ><input
        aria-label="左栏初始占比"
        type="number"
        min="20"
        max="80"
        :value="value"
        @change="
          set(Math.max(20, Math.min(80, Number(($event.target as HTMLInputElement).value) || 50)))
        "
    /></label>
    <p class="lu-muted">选择结构树中的左右内容区添加组件。窄屏时自动上下排列。</p>
  </template>
  <template v-if="node.component === 'LingUI.ChatMessage'">
    <label class="lu-field"
      ><span>发送者</span
      ><input
        maxlength="120"
        :value="node.sender"
        @change="patch('sender', ($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-field"
      ><span>消息样式</span
      ><select
        :value="node.variant ?? 'assistant'"
        @change="patch('variant', ($event.target as HTMLSelectElement).value)"
      >
        <option value="assistant">助手回复</option>
        <option value="user">用户消息</option>
        <option value="note">说明</option>
      </select></label
    >
    <label class="lu-field"
      ><span>补充标记</span
      ><input
        maxlength="120"
        :value="node.metadata ?? ''"
        @change="patch('metadata', ($event.target as HTMLInputElement).value)"
    /></label>
    <p class="lu-muted">用于展示对话内容；消息本身不会调用 AI。</p>
  </template>
  <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
</template>
