<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentNode } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const error = ref('')
function update(options: NonNullable<ComponentNode['options']>) {
  if (
    options.some((option) => !option.value.trim()) ||
    new Set(options.map((option) => option.value)).size !== options.length
  ) {
    error.value = '选项值不能为空或重复，请为每项设置唯一标识。'
    return
  }
  error.value = ''
  emit('update', { ...props.node, options })
}
function change(
  index: number,
  key: 'label' | 'value' | 'group' | 'description' | 'disabled',
  value: string | boolean,
) {
  update(
    props.node.options!.map((option, i) => (i === index ? { ...option, [key]: value } : option)),
  )
}
function add() {
  let index = (props.node.options?.length ?? 0) + 1
  while (props.node.options?.some((option) => option.value === `option-${index}`)) index++
  update([...(props.node.options ?? []), { label: `选项 ${index}`, value: `option-${index}` }])
}
</script>
<template>
  <section
    v-if="
      [
        'ChoicePicker',
        'LingUI.Select',
        'LingUI.SegmentedControl',
        'LingUI.MultiSelect',
        'LingUI.Combobox',
        'LingUI.Transfer',
        'LingUI.CardChoice',
        'LingUI.CheckboxGroup',
      ].includes(node.component)
    "
    class="lu-table-editor"
    aria-label="选择选项编辑"
  >
    <div v-for="(option, index) in node.options" :key="index" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>选项 {{ index + 1 }} 名称</span
        ><input
          :value="option.label"
          @change="change(index, 'label', ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-field"
        ><span>选项 {{ index + 1 }} 值</span
        ><input
          :value="option.value"
          maxlength="160"
          @change="change(index, 'value', ($event.target as HTMLInputElement).value)"
      /></label>
      <template
        v-if="['LingUI.Select', 'LingUI.Combobox', 'LingUI.MultiSelect'].includes(node.component)"
      >
        <label class="lu-field"
          ><span>分组名称</span
          ><input
            maxlength="160"
            :value="option.group ?? ''"
            @change="change(index, 'group', ($event.target as HTMLInputElement).value)"
        /></label>
        <label class="lu-field"
          ><span>说明</span
          ><input
            maxlength="500"
            :value="option.description ?? ''"
            @change="change(index, 'description', ($event.target as HTMLInputElement).value)"
        /></label>
        <label class="lu-check"
          ><input
            type="checkbox"
            :checked="!!option.disabled"
            @change="change(index, 'disabled', ($event.target as HTMLInputElement).checked)"
          />禁用此项</label
        >
      </template>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.options!.length <= 1"
        @click="update(node.options!.filter((_, i) => i !== index))"
      >
        移除此项
      </button>
      <label
        v-if="['LingUI.CardChoice', 'LingUI.CheckboxGroup'].includes(node.component)"
        class="lu-field"
        ><span>选项 {{ index + 1 }} 说明</span
        ><textarea
          rows="2"
          maxlength="500"
          :value="option.description ?? ''"
          @change="
            update(
              node.options!.map((item, i) =>
                i === index
                  ? { ...item, description: ($event.target as HTMLTextAreaElement).value }
                  : item,
              ),
            )
          "
        />
      </label>
    </div>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    <button
      type="button"
      class="lu-button"
      :disabled="
        node.options!.length >=
        (node.component === 'LingUI.SegmentedControl'
          ? 12
          : ['LingUI.CardChoice', 'LingUI.CheckboxGroup'].includes(node.component)
            ? 20
            : 40)
      "
      @click="add"
    >
      添加选项
    </button>
    <p class="lu-muted">选项值用于状态绑定，修改后可在「状态」中调整初始选择。</p>
  </section>
</template>
