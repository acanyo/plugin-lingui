<script setup lang="ts">
import type { Action, ComponentNode } from '@lingui/renderer'
import LocalActionProperties from './LocalActionProperties.vue'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
function patch(key: string, value: unknown) {
  emit('update', { ...props.node, [key]: value })
}
function menu(index: number, patch: Record<string, unknown>) {
  emit('update', {
    ...props.node,
    menuItems: props.node.menuItems!.map((item, i) => (i === index ? { ...item, ...patch } : item)),
  })
}
function add() {
  patch('menuItems', [
    ...props.node.menuItems!,
    {
      id: `item-${crypto.randomUUID().slice(0, 8)}`,
      label: '新操作',
    },
  ])
}
</script>
<template>
  <template v-if="node.component === 'LingUI.Dropdown'">
    <section v-for="(item, index) in node.menuItems" :key="item.id" class="lu-table-editor-row">
      <label class="lu-field"
        ><span>操作名称</span
        ><input
          maxlength="160"
          :value="item.label"
          @change="menu(index, { label: ($event.target as HTMLInputElement).value })"
      /></label>
      <label class="lu-field"
        ><span>分组名称</span
        ><input
          maxlength="160"
          :value="item.group ?? ''"
          @change="menu(index, { group: ($event.target as HTMLInputElement).value })"
      /></label>
      <label class="lu-check"
        ><input
          type="checkbox"
          :checked="!!item.disabled"
          @change="menu(index, { disabled: ($event.target as HTMLInputElement).checked })"
        />禁用此项</label
      >
      <label class="lu-check"
        ><input
          type="checkbox"
          :checked="item.tone === 'danger'"
          @change="
            menu(index, {
              tone: ($event.target as HTMLInputElement).checked ? 'danger' : 'default',
            })
          "
        />危险操作</label
      >
      <LocalActionProperties
        v-if="item.action"
        :action="item.action"
        @update="menu(index, { action: $event })"
      />
      <p v-else class="lu-muted">可在「交互」中配置选择事件，接入 API 或 JS 回调。</p>
      <button
        v-if="!item.action"
        type="button"
        class="lu-text-button"
        @click="
          menu(index, {
            action: {
              functionCall: { call: 'lingui.dispatch', args: { actions: [{ type: 'reset' }] } },
            },
          })
        "
      >
        添加本地动作
      </button>
      <button
        type="button"
        class="lu-text-button danger"
        :disabled="node.menuItems!.length <= 1"
        @click="
          patch(
            'menuItems',
            node.menuItems!.filter((_, i) => i !== index),
          )
        "
      >
        移除此操作
      </button>
    </section>
    <button type="button" class="lu-button" :disabled="node.menuItems!.length >= 20" @click="add">
      添加操作
    </button>
  </template>
  <template v-if="node.component === 'LingUI.Popconfirm'">
    <label v-for="key in ['confirmText', 'cancelText'] as const" :key="key" class="lu-field"
      ><span>{{ key === 'confirmText' ? '确认按钮文字' : '取消按钮文字' }}</span
      ><input
        maxlength="160"
        :value="node[key] ?? ''"
        @change="patch(key, ($event.target as HTMLInputElement).value)"
    /></label>
    <label class="lu-field"
      ><span>提示类型</span
      ><select
        :value="node.tone ?? 'warning'"
        @change="patch('tone', ($event.target as HTMLSelectElement).value)"
      >
        <option value="info">信息</option>
        <option value="warning">提醒</option>
        <option value="danger">危险操作</option>
      </select></label
    >
    <LocalActionProperties
      v-if="node.action"
      :action="node.action as Action"
      @update="patch('action', $event)"
    />
    <p v-else class="lu-muted">可在「交互」中配置确认事件，接入 API 或 JS 回调。</p>
  </template>
</template>
