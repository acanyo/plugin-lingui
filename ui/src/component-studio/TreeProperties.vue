<script setup lang="ts">
import { ref } from 'vue'
import {
  readPath,
  validateDocument,
  type ComponentNode,
  type LinguiDocument,
  type State,
} from '@lingui/renderer'
import { updateNode } from './document-editor'
import { updateBoundValue } from './value-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ document: [document: LinguiDocument] }>()
const error = ref('')
function update(items: NonNullable<ComponentNode['treeItems']>) {
  try {
    let document = validateDocument(updateNode(props.document, { ...props.node, treeItems: items }))
    const field = props.node.value
    const current =
      field && typeof field === 'object' && 'path' in field ? readPath(props.state, field.path) : ''
    if (!items.some((item) => item.id === current))
      document = updateBoundValue(document, props.node, '')
    error.value = ''
    emit('document', document)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '树结构无效'
  }
}
function change(id: string, key: 'label' | 'parent', text: string) {
  update(
    props.node.treeItems!.map((item) => {
      if (item.id !== id) return item
      const next = { ...item }
      if (key === 'parent' && !text) delete next.parent
      else next[key] = text
      return next
    }),
  )
}
function remove(id: string) {
  const removed = new Set([id])
  for (let i = 0; i < 8; i++)
    for (const item of props.node.treeItems!)
      if (item.parent && removed.has(item.parent)) removed.add(item.id)
  update(props.node.treeItems!.filter((item) => !removed.has(item.id)))
}
function add() {
  update([
    ...props.node.treeItems!,
    { id: `item-${crypto.randomUUID().slice(0, 8)}`, label: '新条目' },
  ])
}
</script>
<template>
  <section
    v-if="['LingUI.TreeView', 'LingUI.Cascader', 'LingUI.TreeSelect'].includes(node.component)"
    class="lu-table-editor"
    aria-label="树形导航编辑"
  >
    <div v-for="item in node.treeItems" :key="item.id" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>条目名称</span
        ><input
          maxlength="120"
          :value="item.label"
          @change="change(item.id, 'label', ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-field"
        ><span>所属父级</span
        ><select
          :value="item.parent ?? ''"
          @change="change(item.id, 'parent', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">顶层</option>
          <option
            v-for="parent in node.treeItems!.filter((parent) => parent.id !== item.id)"
            :key="parent.id"
            :value="parent.id"
          >
            {{ parent.label }}
          </option>
        </select></label
      >
      <label v-if="node.component !== 'LingUI.TreeView'" class="lu-check"
        ><input
          type="checkbox"
          :checked="!!item.disabled"
          @change="
            update(
              node.treeItems!.map((entry) =>
                entry.id === item.id
                  ? { ...entry, disabled: ($event.target as HTMLInputElement).checked }
                  : entry,
              ),
            )
          "
        />禁用此节点及子级</label
      >
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.treeItems!.length <= 1"
        @click="remove(item.id)"
      >
        移除条目及子级
      </button>
    </div>
    <button type="button" class="lu-button" :disabled="node.treeItems!.length >= 40" @click="add">
      添加条目
    </button>
    <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
  </section>
</template>
