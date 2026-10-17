<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  readPath,
  type ComponentNode,
  type LinguiDocument,
  type State,
  type JsonValue,
} from '@lingui/renderer'
import { updateBoundValue } from './value-editor'
import { updateNode } from './document-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ update: [node: ComponentNode]; document: [document: LinguiDocument] }>()
const error = ref('')
const rows = computed(() => {
  const binding = props.node.value
  const value =
    binding && typeof binding === 'object' && 'path' in binding
      ? readPath(props.state, binding.path)
      : []
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, JsonValue> =>
          !!row && typeof row === 'object' && !Array.isArray(row),
      )
    : []
})
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
function fields(next: NonNullable<ComponentNode['fields']>) {
  if (
    next.some(
      (field) =>
        !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(field.key) ||
        ['constructor', 'prototype', '__proto__'].includes(field.key),
    ) ||
    new Set(next.map((field) => field.key)).size !== next.length
  ) {
    error.value = '字段标识需要安全且唯一的英文名称。'
    return
  }
  error.value = ''
  emit('update', { ...props.node, fields: next })
}
function rename(index: number, key: string) {
  const old = props.node.fields![index]!.key
  const next = props.node.fields!.map((field, i) => (i === index ? { ...field, key } : field))
  if (
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(key) ||
    ['constructor', 'prototype', '__proto__'].includes(key) ||
    new Set(next.map((field) => field.key)).size !== next.length
  ) {
    error.value = '字段标识需要安全且唯一的英文名称。'
    return
  }
  const document = updateNode(props.document, { ...props.node, fields: next })
  error.value = ''
  emit(
    'document',
    updateBoundValue(
      document,
      props.node,
      rows.value.map((row) => {
        const result = { ...row }
        delete result[old]
        return { ...result, [key]: row[old] ?? '' }
      }),
    ),
  )
}
function set(value: Record<string, JsonValue>[]) {
  error.value = ''
  emit('document', updateBoundValue(props.document, props.node, value))
}
function bound(key: 'minRows' | 'maxRows', value: number) {
  const min = key === 'minRows' ? value : (props.node.minRows ?? 0),
    max = key === 'maxRows' ? value : (props.node.maxRows ?? 10)
  if (
    !Number.isInteger(value) ||
    min < 0 ||
    max > 20 ||
    max < 1 ||
    min > max ||
    rows.value.length > max
  ) {
    error.value = '行数范围无效，已有条目不能超过最大行数。'
    return
  }
  let document = updateNode(props.document, { ...props.node, [key]: value })
  if (rows.value.length < min)
    document = updateBoundValue(document, props.node, [
      ...rows.value,
      ...Array.from({ length: min - rows.value.length }, () =>
        Object.fromEntries(props.node.fields!.map((field) => [field.key, ''])),
      ),
    ])
  error.value = ''
  emit('document', document)
}
</script>
<template>
  <section v-if="node.component === 'LingUI.DynamicInput'" class="lu-table-editor">
    <label v-for="key in ['minRows', 'maxRows'] as const" :key="key" class="lu-field"
      ><span>{{ key === 'minRows' ? '最少保留行数' : '最大行数' }}</span
      ><input
        type="number"
        :min="key === 'minRows' ? 0 : 1"
        max="20"
        :value="node[key] ?? (key === 'minRows' ? 0 : 10)"
        @change="bound(key, Number(($event.target as HTMLInputElement).value))"
    /></label>
    <label class="lu-field"
      ><span>添加按钮文字</span
      ><input
        maxlength="160"
        :value="node.addText ?? ''"
        @change="patch('addText', ($event.target as HTMLInputElement).value)"
    /></label>
    <div v-for="(field, index) in node.fields" :key="index" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>字段标识</span
        ><input
          :value="field.key"
          maxlength="40"
          @change="rename(index, ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-field"
        ><span>字段名称</span
        ><input
          :value="field.label"
          maxlength="160"
          @change="
            fields(
              node.fields!.map((item, i) =>
                i === index ? { ...item, label: ($event.target as HTMLInputElement).value } : item,
              ),
            )
          "
      /></label>
      <label class="lu-field"
        ><span>输入提示</span
        ><input
          :value="field.placeholder ?? ''"
          maxlength="160"
          @change="
            fields(
              node.fields!.map((item, i) =>
                i === index
                  ? { ...item, placeholder: ($event.target as HTMLInputElement).value }
                  : item,
              ),
            )
          "
      /></label>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.fields!.length <= 1"
        @click="fields(node.fields!.filter((_, i) => i !== index))"
      >
        移除字段
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.fields!.length >= 4"
      @click="fields([...node.fields!, { key: `field${Date.now()}`, label: '新字段' }])"
    >
      添加字段
    </button>
    <h3>初始条目</h3>
    <div v-for="(row, index) in rows" :key="index" class="lu-table-editor-row">
      <label v-for="field in node.fields" :key="field.key" class="lu-field"
        ><span>{{ field.label }}</span
        ><input
          :value="row[field.key]"
          maxlength="500"
          @change="
            set(
              rows.map((item, i) =>
                i === index
                  ? { ...item, [field.key]: ($event.target as HTMLInputElement).value }
                  : item,
              ),
            )
          "
      /></label>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="rows.length <= (node.minRows ?? 0)"
        @click="set(rows.filter((_, i) => i !== index))"
      >
        移除此条目
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="rows.length >= (node.maxRows ?? 10)"
      @click="set([...rows, Object.fromEntries(node.fields!.map((field) => [field.key, '']))])"
    >
      添加初始条目
    </button>
    <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
  </section>
</template>
