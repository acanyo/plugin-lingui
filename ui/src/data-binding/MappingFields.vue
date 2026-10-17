<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentNode, JsonValue } from '@lingui/renderer'
import { mappingFields } from './mapping-schema'
import FieldPicker from './FieldPicker.vue'
const props = defineProps<{
  node: ComponentNode
  property: string
  modelValue: string
  record?: JsonValue
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const fieldLabels: Record<string, string> = {
  id: '标识',
  label: '显示名称',
  value: '数值',
  description: '描述',
  cells: '单元格',
  color: '颜色',
  name: '名称',
  url: '链接',
  parent: '父级标识',
  disabled: '禁用',
  x: '横轴',
  y: '纵轴',
  size: '大小',
  column: '所属列',
  avatar: '头像',
  text: '文字',
}
const typeLabels: Record<string, string> = {
  string: '文字',
  number: '数字',
  array: '多列字段',
  boolean: '开关',
  value: '字段',
}
const targets = computed(() => mappingFields(props.node, props.property))
const mapping = computed<Record<string, string | string[]> | undefined>(() => {
  try {
    const value = props.modelValue.trim() ? JSON.parse(props.modelValue) : {}
    return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
  } catch {
    return undefined
  }
})
const samples = computed(() =>
  props.record === undefined ? [] : [{ label: '每条记录', path: '/', value: props.record }],
)
function paths(name: string): string[] {
  const value = mapping.value?.[name]
  return Array.isArray(value) ? value : []
}
function path(name: string): string {
  const value = mapping.value?.[name]
  return typeof value === 'string' ? value : ''
}
function update(name: string, path: string, index?: number) {
  const next = { ...mapping.value }
  if (index === undefined) {
    if (path) next[name] = path
    else delete next[name]
  } else {
    const current = Array.isArray(next[name]) ? [...next[name]] : []
    if (path) current[index] = path
    else current.splice(index, 1)
    if (current.length) next[name] = current
    else delete next[name]
  }
  emit('update:modelValue', Object.keys(next).length ? JSON.stringify(next, null, 2) : '')
}
</script>
<template>
  <div v-if="mapping && targets.length" class="lu-mapping-fields">
    <div v-for="field in targets" :key="field.name" class="lu-field">
      <span
        >{{ fieldLabels[field.name] ?? field.name }} <code>{{ field.name }}</code>
        <small
          >{{ field.required ? '必填' : '选填' }} ·
          {{ typeLabels[field.type] ?? field.type }}</small
        ></span
      >
      <template v-if="field.type === 'array'">
        <template v-if="typeof mapping[field.name] === 'string'">
          <FieldPicker
            :model-value="path(field.name)"
            :samples="samples"
            :label="`${field.name} 数组字段`"
            arrays-only
            @update:model-value="update(field.name, $event)"
          />
          <button type="button" class="lu-text-button" @click="update(field.name, '')">
            改为逐列映射
          </button>
        </template>
        <template v-else>
          <div v-for="(path, index) in paths(field.name)" :key="index" class="lu-mapping-cell">
            <FieldPicker
              :model-value="path"
              :samples="samples"
              :label="`${field.name} 第 ${index + 1} 列`"
              @update:model-value="update(field.name, $event, index)"
            />
            <button
              type="button"
              class="lu-text-button"
              :aria-label="`删除 ${field.name} 第 ${index + 1} 列`"
              @click="update(field.name, '', index)"
            >
              移除
            </button>
          </div>
          <button
            type="button"
            class="lu-text-button"
            @click="update(field.name, '/', paths(field.name).length)"
          >
            添加映射列
          </button>
          <button
            v-if="!paths(field.name).length"
            type="button"
            class="lu-text-button"
            @click="update(field.name, '/')"
          >
            选择已有数组字段
          </button>
        </template>
      </template>
      <FieldPicker
        v-else
        :model-value="path(field.name)"
        :samples="samples"
        :label="`${field.name} 字段`"
        @update:model-value="update(field.name, $event)"
      />
    </div>
  </div>
  <p v-else class="lu-muted">当前映射请在高级 JSON 中编辑。</p>
</template>
