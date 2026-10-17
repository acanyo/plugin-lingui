<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import type { ComponentNode, LocalAction } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
const actions = shallowRef<LocalAction[]>([]),
  error = ref('')
const names = {
  setState: '设置状态',
  toggleState: '切换状态',
  increment: '增加',
  decrement: '减少',
  selectOption: '选择选项',
  show: '显示',
  hide: '隐藏',
  nextStep: '下一步',
  previousStep: '上一步',
  reset: '重置',
}
watch(
  () => props.node,
  (node) => {
    actions.value = JSON.parse(
      JSON.stringify(
        node.action?.functionCall?.call === 'lingui.dispatch'
          ? node.action.functionCall.args.actions
          : [],
      ),
    )
    error.value = ''
  },
  { immediate: true, deep: true },
)
function apply() {
  emit('update', {
    ...props.node,
    action: { functionCall: { call: 'lingui.dispatch', args: { actions: actions.value } } },
  })
}
function changeValue(index: number, text: string) {
  try {
    actions.value[index]!.value = JSON.parse(text)
    error.value = ''
    apply()
  } catch {
    error.value = '值必须是 JSON，例如 true、10、"选项" 或 {"path":"/count"}'
  }
}
function add() {
  actions.value.push({ type: 'reset' })
  apply()
}
function changeType(index: number, type: LocalAction['type']) {
  const item: LocalAction = { type }
  if (type !== 'reset') item.path = '/count'
  if (['setState', 'selectOption'].includes(type)) item.value = 0
  actions.value[index] = item
  apply()
}
function remove(index: number) {
  actions.value.splice(index, 1)
  apply()
}
</script>
<template>
  <section v-if="['Button','LingUI.IconButton'].includes(node.component)" class="lu-action-editor">
    <h3>点击之后</h3>
    <div v-for="(action, index) in actions" :key="index" class="lu-action">
      <label class="lu-field"
        ><span>动作 {{ index + 1 }}</span
        ><select
          :value="action.type"
          @change="
            changeType(index, ($event.target as HTMLSelectElement).value as LocalAction['type'])
          "
        >
          <option v-for="(label, name) in names" :key="name" :value="name">{{ label }}</option>
        </select></label
      ><label v-if="action.type !== 'reset'" class="lu-field"
        ><span>状态路径</span
        ><input v-model="action.path" placeholder="/count" @change="apply" /></label
      ><label
        v-if="['setState', 'selectOption', 'increment', 'decrement'].includes(action.type)"
        class="lu-field"
        ><span>值或计算表达式</span
        ><input
          :value="JSON.stringify(action.value ?? 1)"
          @change="changeValue(index, ($event.target as HTMLInputElement).value)" /></label
      ><button
        v-if="actions.length > 1"
        type="button"
        class="lu-text-button"
        @click="remove(index)"
      >
        移除动作
      </button>
    </div>
    <button type="button" class="lu-button" @click="add">＋ 添加动作</button>
    <p v-if="error" class="lu-error">{{ error }}</p>
  </section>
  <p v-else class="lu-muted">
    输入、选择和展开组件通过节点中的状态路径绑定。添加按钮后可以配置点击动作。
  </p>
</template>
