<script setup lang="ts">
import { computed, ref } from 'vue'
import { readPath, type ComponentNode, type LinguiDocument, type State } from '@lingui/renderer'
import { editCarousel } from './carousel-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument; state: State }>()
const emit = defineEmits<{ document: [document: LinguiDocument] }>()
const error = ref('')
const selected = computed(() =>
  props.node.value && typeof props.node.value === 'object' && 'path' in props.node.value
    ? Number(readPath(props.state, props.node.value.path))
    : 0,
)
function edit(operation: 'add' | 'remove' | 'select', index = 0) {
  try {
    emit('document', editCarousel(props.document, props.node.id, operation, index))
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '轮播修改失败'
  }
}
</script>
<template>
  <section
    v-if="node.component === 'LingUI.Carousel'"
    class="lu-table-editor"
    aria-label="轮播页编辑"
  >
    <label class="lu-field"
      ><span>初始显示页</span
      ><select
        aria-label="初始显示页"
        :value="selected"
        @change="edit('select', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="(_, index) in node.children" :key="index" :value="index">
          第 {{ index + 1 }} 页
        </option>
      </select></label
    >
    <div v-for="(child, index) in node.children" :key="child" class="lu-table-editor-row">
      <span>第 {{ index + 1 }} 页</span
      ><button
        type="button"
        class="lu-text-button danger"
        :disabled="node.children!.length <= 1"
        @click="edit('remove', index)"
      >
        移除此页
      </button>
    </div>
    <button
      type="button"
      class="lu-button"
      :disabled="node.children!.length >= 12"
      @click="edit('add')"
    >
      添加轮播页
    </button>
    <p class="lu-muted">从结构树选择每页内容，继续添加或编辑组件。</p>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
  </section>
</template>
