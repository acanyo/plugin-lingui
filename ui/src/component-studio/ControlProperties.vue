<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const fields = [
  'TextField',
  'LingUI.NumberInput',
  'LingUI.SearchInput',
  'LingUI.PasswordInput',
  'LingUI.Select',
  'LingUI.Combobox',
  'LingUI.MultiSelect',
  'LingUI.TagInput',
  'DateTimeInput',
  'LingUI.DateRange',
  'LingUI.Cascader',
  'LingUI.TreeSelect',
  'LingUI.DynamicInput',
]
const texts = ['TextField', 'LingUI.NumberInput', 'LingUI.SearchInput', 'LingUI.PasswordInput']
const buttons = ['Button', 'LingUI.IconButton', 'LingUI.Dropdown', 'LingUI.Popconfirm']
const field = computed(() => fields.includes(props.node.component))
const button = computed(() => buttons.includes(props.node.component))
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
</script>
<template>
  <template v-if="field || button || node.component === 'LingUI.Badge'">
    <label class="lu-field"
      ><span>控件尺寸</span
      ><select
        :value="node.size ?? (node.component === 'LingUI.Badge' ? 'small' : 'medium')"
        @change="patch('size', ($event.target as HTMLSelectElement).value)"
      >
        <option value="small">紧凑</option>
        <option value="medium">标准</option>
        <option value="large">宽松</option>
      </select></label
    >
    <label v-if="(field || button) && typeof node.disabled !== 'object'" class="lu-check"
      ><input
        type="checkbox"
        :checked="!!node.disabled"
        @change="patch('disabled', ($event.target as HTMLInputElement).checked)"
      />禁用交互</label
    >
  </template>
  <template v-if="['Button', 'LingUI.IconButton'].includes(node.component)">
    <label class="lu-field"
      ><span>按钮行为</span
      ><select
        :value="node.buttonType ?? 'button'"
        @change="patch('buttonType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="button">普通按钮</option>
        <option value="submit">提交所在表单</option>
      </select></label
    >
    <label v-if="typeof node.loading !== 'object'" class="lu-check"
      ><input
        type="checkbox"
        :checked="!!node.loading"
        @change="patch('loading', ($event.target as HTMLInputElement).checked)"
      />加载中</label
    >
    <label class="lu-field"
      ><span>语义颜色</span
      ><select
        :value="node.tone ?? 'info'"
        @change="patch('tone', ($event.target as HTMLSelectElement).value)"
      >
        <option value="info">主题色</option>
        <option value="success">成功</option>
        <option value="warning">提醒</option>
        <option value="danger">危险操作</option>
      </select></label
    >
  </template>
  <template v-if="field">
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="!!node.readOnly"
        @change="patch('readOnly', ($event.target as HTMLInputElement).checked)"
      />只读展示</label
    >
    <label class="lu-field"
      ><span>校验状态</span
      ><select
        :value="node.status ?? 'default'"
        @change="patch('status', ($event.target as HTMLSelectElement).value)"
      >
        <option value="default">默认</option>
        <option value="warning">提醒</option>
        <option value="error">错误</option>
      </select></label
    >
    <label class="lu-field"
      ><span>辅助提示</span
      ><input
        maxlength="160"
        :value="node.hint ?? ''"
        @change="patch('hint', ($event.target as HTMLInputElement).value)"
    /></label>
    <label
      v-if="!['LingUI.DynamicInput', 'LingUI.TagInput'].includes(node.component)"
      class="lu-field"
      ><span>输入提示</span
      ><input
        maxlength="160"
        :value="node.placeholder ?? ''"
        @change="patch('placeholder', ($event.target as HTMLInputElement).value)"
    /></label>
    <label
      v-if="
        !['LingUI.DynamicInput', 'LingUI.TagInput', 'LingUI.NumberInput'].includes(node.component)
      "
      class="lu-check"
      ><input
        type="checkbox"
        :checked="node.clearable !== false"
        @change="patch('clearable', ($event.target as HTMLInputElement).checked)"
      />允许清空</label
    >
  </template>
  <template v-if="texts.includes(node.component)">
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="!!node.required"
        @change="patch('required', ($event.target as HTMLInputElement).checked)"
      />必填</label
    >
    <label v-if="node.component !== 'LingUI.NumberInput'" class="lu-field"
      ><span>最少字符</span
      ><input
        type="number"
        min="0"
        max="2000"
        :value="node.minLength ?? 0"
        @change="
          patch(
            'minLength',
            Math.max(
              0,
              Math.min(2000, Math.round(Number(($event.target as HTMLInputElement).value) || 0)),
            ),
          )
        "
    /></label>
    <label v-for="key in ['prefixText', 'suffixText'] as const" :key="key" class="lu-field"
      ><span>{{ key === 'prefixText' ? '前缀文字' : '后缀文字' }}</span
      ><input
        maxlength="160"
        :value="node[key] ?? ''"
        @change="patch(key, ($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="!!node.showCount"
        @change="patch('showCount', ($event.target as HTMLInputElement).checked)"
      />显示字数</label
    >
    <label class="lu-field"
      ><span>最多字符</span
      ><input
        type="number"
        min="1"
        max="2000"
        :value="node.maxLength ?? 2000"
        @change="
          patch(
            'maxLength',
            Math.max(
              1,
              Math.min(2000, Math.round(Number(($event.target as HTMLInputElement).value) || 2000)),
            ),
          )
        "
    /></label>
  </template>
  <label v-if="node.component === 'LingUI.MultiSelect'" class="lu-field"
    ><span>最多显示标签</span
    ><input
      type="number"
      min="1"
      max="6"
      :value="node.maxVisible ?? 2"
      @change="
        patch(
          'maxVisible',
          Math.max(
            1,
            Math.min(6, Math.round(Number(($event.target as HTMLInputElement).value) || 2)),
          ),
        )
      "
  /></label>
  <label v-if="node.component === 'LingUI.Badge'" class="lu-field"
    ><span>标签外观</span
    ><select
      :value="node.variant ?? 'soft'"
      @change="patch('variant', ($event.target as HTMLSelectElement).value)"
    >
      <option value="soft">浅色</option>
      <option value="outline">描边</option>
      <option value="solid">实色</option>
    </select></label
  >
</template>
