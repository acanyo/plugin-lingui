<script setup lang="ts">
import { ref, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'
import LinguiIcon from '../shared/LinguiIcon.vue'
import './toolbar.css'

defineProps<{
  title?: string
  status: string
  dirty: boolean
  busy: boolean
  operationBlock: string
  canSave: boolean
  savedVersion?: number
  hasRevisions: boolean
  canUndo?: boolean
  canRedo?: boolean
  undoReason: string
  redoReason: string
  externalDraftCount?: number
}>()
type ToolbarAction =
  | 'projects'
  | 'new'
  | 'undo'
  | 'redo'
  | 'save'
  | 'history'
  | 'externalDrafts'
  | 'revisions'
  | 'readiness'
  | 'export'
  | 'embed'
  | 'submission'
const emit = defineEmits<{
  action: [name: ToolbarAction]
  rename: [event: Event]
}>()
const menu = ref<HTMLDetailsElement>()
const menuId = useId()
function closeMenu(restoreFocus = false) {
  if (!menu.value?.open) return
  menu.value.open = false
  if (restoreFocus) menu.value.querySelector('summary')?.focus()
}
onClickOutside(menu, () => closeMenu())
function action(name: ToolbarAction) {
  closeMenu(true)
  emit('action', name)
}
function leaveMenu(event: FocusEvent) {
  if (event.relatedTarget && !menu.value?.contains(event.relatedTarget as Node)) closeMenu()
}
function navigateMenu(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  if (!menu.value) return
  event.preventDefault()
  menu.value.open = true
  const buttons = Array.from(
    menu.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
  ).filter((button) => button.getClientRects().length)
  if (!buttons.length) return
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === 'ArrowDown'
          ? (index + 1) % buttons.length
          : (index <= 0 ? buttons.length : index) - 1
  buttons[next]?.focus()
}
</script>

<template>
  <header class="lu-workspace-toolbar">
    <div class="lu-workspace-identity">
      <span class="lu-workspace-symbol"><LinguiIcon name="layers" /></span>
      <div class="lu-workspace-title">
        <input
          v-if="title !== undefined"
          :value="title"
          class="lu-title-input"
          aria-label="组件名称"
          title="点击修改作品名称"
          name="component-title"
          autocomplete="off"
          maxlength="120"
          @change="emit('rename', $event)"
        />
        <strong v-else>新作品</strong>
        <span
          class="lu-workspace-state"
          :class="{ 'is-dirty': dirty, 'is-busy': busy }"
          role="status"
        >
          <span aria-hidden="true" />{{ status }}
        </span>
      </div>
    </div>
    <div class="lu-workspace-actions">
      <div class="lu-workspace-shortcuts">
        <button
          type="button"
          class="lu-workspace-action"
          aria-label="我的项目"
          title="我的项目"
          @click="action('projects')"
        >
          <LinguiIcon name="grid" /><span>我的项目</span>
        </button>
        <button
          type="button"
          class="lu-workspace-action"
          aria-label="新建对话"
          :disabled="busy"
          :title="busy ? operationBlock : '新建对话'"
          :aria-description="busy ? operationBlock : undefined"
          @click="action('new')"
        >
          <LinguiIcon name="plus" /><span>新建对话</span>
        </button>
      </div>
      <div v-if="hasRevisions" class="lu-workspace-undo">
        <button
          type="button"
          class="lu-workspace-action"
          aria-label="撤销修改"
          :title="undoReason || '撤销修改'"
          :aria-description="undoReason || undefined"
          :disabled="!canUndo || !!operationBlock"
          @click="action('undo')"
        >
          <LinguiIcon name="undo" />
        </button>
        <button
          type="button"
          class="lu-workspace-action"
          aria-label="重做修改"
          :title="redoReason || '重做修改'"
          :aria-description="redoReason || undefined"
          :disabled="!canRedo || !!operationBlock"
          @click="action('redo')"
        >
          <LinguiIcon name="redo" />
        </button>
      </div>
      <details
        ref="menu"
        class="lu-workspace-more"
        @keydown.esc.stop.prevent="closeMenu(true)"
        @keydown="navigateMenu"
        @focusout="leaveMenu"
      >
        <summary aria-label="更多操作" title="更多操作" :aria-controls="menuId">
          <LinguiIcon name="more" /><span class="lu-workspace-more-label">更多</span>
          <span
            v-if="externalDraftCount"
            class="lu-workspace-pending"
            :aria-label="`${externalDraftCount} 个待处理外部 AI 草稿`"
            >{{ externalDraftCount > 99 ? '99+' : externalDraftCount }}</span
          >
        </summary>
        <div :id="menuId" class="lu-workspace-menu" aria-label="更多作品操作">
          <div class="lu-workspace-menu-group lu-workspace-mobile-shortcuts">
            <button type="button" @click="action('projects')">
              <LinguiIcon name="grid" />我的项目
            </button>
            <button
              type="button"
              :disabled="busy"
              :title="busy ? operationBlock : undefined"
              @click="action('new')"
            >
              <LinguiIcon name="plus" />新建对话
            </button>
          </div>
          <div class="lu-workspace-menu-group">
            <span class="lu-workspace-menu-heading">创作记录</span>
            <button type="button" @click="action('history')">
              <LinguiIcon name="message" />创作历史
            </button>
            <button
              v-if="externalDraftCount !== undefined"
              type="button"
              @click="action('externalDrafts')"
            >
              <LinguiIcon name="code" />外部 AI 草稿<span
                v-if="externalDraftCount"
                class="lu-workspace-menu-count"
                >{{ externalDraftCount }}</span
              >
            </button>
            <button v-if="hasRevisions" type="button" @click="action('revisions')">
              <LinguiIcon name="clock" />作品版本
            </button>
          </div>
          <div v-if="hasRevisions" class="lu-workspace-menu-group lu-workspace-mobile-undo">
            <button
              type="button"
              :disabled="!canUndo || !!operationBlock"
              :title="undoReason || undefined"
              @click="action('undo')"
            >
              <LinguiIcon name="undo" />撤销修改
            </button>
            <button
              type="button"
              :disabled="!canRedo || !!operationBlock"
              :title="redoReason || undefined"
              @click="action('redo')"
            >
              <LinguiIcon name="redo" />重做修改
            </button>
          </div>
          <div v-if="title !== undefined" class="lu-workspace-menu-group">
            <span class="lu-workspace-menu-heading">导出与发布</span>
            <button type="button" @click="action('readiness')">
              <LinguiIcon name="check" />发布前检查
            </button>
            <button type="button" @click="action('export')">
              <LinguiIcon name="download" />导出
            </button>
            <button type="button" @click="action('embed')">
              <LinguiIcon name="code" />复制嵌入代码
            </button>
            <button type="button" @click="action('submission')">
              <LinguiIcon name="layers" />准备投稿
            </button>
          </div>
        </div>
      </details>
      <button
        v-if="title !== undefined && canSave"
        type="button"
        class="lu-button primary lu-workspace-save"
        :class="{ 'has-insert': !!$slots.insert }"
        :disabled="!!operationBlock"
        :title="operationBlock || undefined"
        :aria-description="operationBlock || undefined"
        @click="action('save')"
      >
        {{ savedVersion ? '保存新版本' : '保存项目' }}
      </button>
      <div v-if="title !== undefined && $slots.insert" class="lu-workspace-insert">
        <slot name="insert" />
      </div>
    </div>
  </header>
</template>
