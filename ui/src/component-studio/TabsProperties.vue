<script setup lang="ts">
import {
  readPath,
  type ComponentNode,
  type Dynamic,
  type LinguiDocument,
  type State,
} from '@lingui/renderer'
import { addTab, removeTab, renameTab } from './tabs-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ document: [document: LinguiDocument] }>()
function label(value: Dynamic | undefined) {
  return typeof value === 'object' && 'path' in value
    ? String(readPath(props.state, value.path) ?? '')
    : typeof value === 'object'
      ? '根据参数计算'
      : String(value ?? '')
}
</script>
<template>
  <section
    v-if="node.component === 'Tabs' || node.component === 'LingUI.Tabs'"
    class="lu-table-editor"
    aria-label="标签页编辑"
  >
    <div v-for="(tab, index) in node.tabs" :key="tab.child" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>第 {{ index + 1 }} 页标题</span
        ><input
          :value="label(tab.title)"
          :disabled="typeof tab.title === 'object' && 'call' in tab.title"
          @change="
            emit(
              'document',
              renameTab(document, node.id, index, ($event.target as HTMLInputElement).value),
            )
          "
      /></label>
      <p class="lu-muted">内容容器：{{ tab.child }}，在左侧结构中选择后添加内容。</p>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.tabs!.length <= 1"
        @click="emit('document', removeTab(document, node.id, index))"
      >
        移除此页
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.tabs!.length >= 20"
      @click="emit('document', addTab(document, node.id))"
    >
      添加标签页
    </button>
  </section>
</template>
