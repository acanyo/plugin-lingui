<script setup lang="ts">
import { computed } from 'vue'
import { readPath, type ComponentNode, type LinguiDocument, type State } from '@lingui/renderer'
import { editAccordion } from './accordion-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ update: [node: ComponentNode]; document: [document: LinguiDocument] }>()
const selected = computed(() =>
  props.node.value && typeof props.node.value === 'object' && 'path' in props.node.value
    ? readPath(props.state, props.node.value.path)
    : [],
)
function edit(operation: 'add' | 'remove' | 'rename' | 'select', index = 0, title = '') {
  emit('document', editAccordion(props.document, props.node.id, operation, index, title))
}
</script>
<template>
  <section
    v-if="node.component === 'LingUI.Accordion'"
    class="lu-table-editor"
    aria-label="手风琴分组编辑"
  >
    <label class="lu-check"
      ><input
        type="checkbox"
        :checked="node.allowMultiple"
        @change="
          emit('update', { ...node, allowMultiple: ($event.target as HTMLInputElement).checked })
        "
      />允许同时展开多项</label
    >
    <div v-for="(section, index) in node.sections" :key="section.child" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>分组 {{ index + 1 }} 标题</span
        ><input
          :value="section.title"
          @change="edit('rename', index, ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="lu-check"
        ><input
          type="checkbox"
          :checked="Array.isArray(selected) && selected.includes(section.child)"
          @change="edit('select', index)"
        />初始展开</label
      >
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.sections!.length <= 1"
        @click="edit('remove', index)"
      >
        移除此组
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.sections!.length >= 12"
      @click="edit('add')"
    >
      添加分组
    </button>
    <p class="lu-muted">在左侧选择分组的纵向布局，继续添加和编辑内容。</p>
  </section>
</template>
