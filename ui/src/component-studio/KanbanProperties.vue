<script setup lang="ts">
import { ref } from 'vue'
import { validateDocument, type ComponentNode, type LinguiDocument } from '@lingui/renderer'
import { updateNode } from './document-editor'
const props = defineProps<{ node: ComponentNode; document: LinguiDocument }>()
const emit = defineEmits<{ document: [document: LinguiDocument] }>()
const error = ref('')
function addColumn() {
  update([
    ...props.node.boards!,
    { id: `stage-${crypto.randomUUID().slice(0, 8)}`, title: '新阶段', cards: [] },
  ])
}
type Boards = NonNullable<ComponentNode['boards']>
function update(boards: Boards) {
  try {
    const document = validateDocument(updateNode(props.document, { ...props.node, boards }))
    error.value = ''
    emit('document', document)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '看板数据无效'
  }
}
function editColumn(id: string, title: string) {
  update(props.node.boards!.map((board) => (board.id === id ? { ...board, title } : board)))
}
function editCard(id: string, key: 'title' | 'description' | 'tag', text: string) {
  update(
    props.node.boards!.map((board) => ({
      ...board,
      cards: board.cards.map((card) => (card.id === id ? { ...card, [key]: text } : card)),
    })),
  )
}
function addCard(id: string) {
  update(
    props.node.boards!.map((board) =>
      board.id === id
        ? {
            ...board,
            cards: [
              ...board.cards,
              { id: `task-${crypto.randomUUID().slice(0, 8)}`, title: '新任务' },
            ],
          }
        : board,
    ),
  )
}
</script>
<template>
  <section
    v-if="node.component === 'LingUI.Kanban'"
    class="lu-table-editor"
    aria-label="任务看板编辑"
  >
    <div v-for="board in node.boards" :key="board.id" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>阶段名称</span
        ><input
          maxlength="120"
          :value="board.title"
          @change="editColumn(board.id, ($event.target as HTMLInputElement).value)"
      /></label>
      <div v-for="card in board.cards" :key="card.id" class="lu-table-editor-row">
        <label v-for="key in ['title', 'description', 'tag'] as const" :key="key" class="lu-field"
          ><span>{{ { title: '任务名称', description: '任务说明', tag: '标签' }[key] }}</span
          ><input
            :maxlength="key === 'description' ? 500 : key === 'tag' ? 40 : 120"
            :value="card[key] ?? ''"
            @change="editCard(card.id, key, ($event.target as HTMLInputElement).value)"
        /></label>
        <button
          type="button"
          class="lu-text-button danger"
          @click="
            update(
              node.boards!.map((item) => ({
                ...item,
                cards: item.cards.filter((item) => item.id !== card.id),
              })),
            )
          "
        >
          移除任务
        </button>
      </div>
      <button
        type="button"
        class="lu-button"
        :disabled="
          board.cards.length >= 12 ||
          node.boards!.reduce((count, item) => count + item.cards.length, 0) >= 24
        "
        @click="addCard(board.id)"
      >
        添加任务
      </button>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.boards!.length <= 2 || board.cards.length > 0"
        @click="update(node.boards!.filter((item) => item.id !== board.id))"
      >
        移除空阶段
      </button>
    </div>
    <button type="button" class="lu-button" :disabled="node.boards!.length >= 4" @click="addColumn">
      添加阶段
    </button>
    <p class="lu-muted">调整任务的初始阶段可在「状态」中设置。读者移动任务仅影响当前实例。</p>
    <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
  </section>
</template>
