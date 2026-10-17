<script setup lang="ts">
import { readPath, type ComponentNode, type State } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode; state: State }>()
const emit = defineEmits<{
  update: [node: ComponentNode]
  text: [property: 'url', value: string]
}>()
function item(index: number, key: 'label' | 'url', value: string) {
  emit('update', {
    ...props.node,
    items: props.node.items!.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
  })
}
function url() {
  const value = props.node.url
  return typeof value === 'object'
    ? 'path' in value
      ? String(readPath(props.state, value.path) ?? '')
      : ''
    : String(value ?? '')
}
</script>
<template>
  <template v-if="['LingUI.Link', 'LingUI.FileCard'].includes(node.component)">
    <label class="lu-field"
      ><span>链接地址</span
      ><input
        :value="url()"
        placeholder="https://…、/路径 或 #锚点"
        :disabled="typeof node.url === 'object' && 'call' in node.url"
        @change="emit('text', 'url', ($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="node.newWindow"
        @change="
          emit('update', { ...node, newWindow: ($event.target as HTMLInputElement).checked })
        "
      />在新窗口打开</label
    >
  </template>
  <section
    v-if="node.component === 'LingUI.Breadcrumbs'"
    class="lu-table-editor"
    aria-label="导航层级编辑"
  >
    <div v-for="(entry, index) in node.items" :key="index" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>第 {{ index + 1 }} 层名称</span
        ><input
          :value="entry.label"
          @change="item(index, 'label', ($event.target as HTMLInputElement).value)"
      /></label>
      <label v-if="index < node.items!.length - 1" class="lu-field"
        ><span>链接地址（可选）</span
        ><input
          :value="entry.url ?? ''"
          placeholder="https://… 或 /路径"
          @change="item(index, 'url', ($event.target as HTMLInputElement).value)"
      /></label>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.items!.length <= 1"
        @click="emit('update', { ...node, items: node.items!.filter((_, i) => i !== index) })"
      >
        移除此层
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.items!.length >= 12"
      @click="emit('update', { ...node, items: [...node.items!, { label: '新层级' }] })"
    >
      添加层级
    </button>
    <p class="lu-muted">最后一层表示当前位置，不跳转。</p>
  </section>
</template>
