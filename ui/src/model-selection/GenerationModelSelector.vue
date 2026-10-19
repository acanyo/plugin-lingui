<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchModelSelection } from './context'
import LinguiIcon from '../shared/LinguiIcon.vue'

defineProps<{ disabled?: boolean }>()
const selection = useWorkbenchModelSelection()
const notice = computed(() => selection?.error.value || selection?.persistenceError.value)
const hint = '切换生成模型，组件、主题与多方案共用；清空后使用默认模型。'
</script>

<template>
  <div
    v-if="selection"
    class="lu-generation-model"
    role="group"
    aria-label="生成模型"
    :aria-busy="selection.loading.value || selection.awaitingIdentity.value"
    :title="hint"
  >
    <span v-if="selection.awaitingIdentity.value" class="lu-model-loading lu-muted" role="status">
      正在确认账号…
    </span>
    <template v-else>
      <FormKit
        type="aiModelSelector"
        name="generation-model"
        model-type="language"
        :delay="0"
        :model-value="selection.modelName.value"
        :available="true"
        :required-features="['tool-call']"
        :clearable="true"
        :disabled="disabled || selection.loading.value || selection.generating.value"
        :placeholder="selection.loading.value ? '载入模型…' : '默认模型'"
        @update:model-value="selection.select"
      />
      <details v-if="notice" class="lu-model-notice">
        <summary aria-label="查看模型设置提示" :title="notice">
          <LinguiIcon name="warning" />
        </summary>
        <div class="lu-model-notice-content" role="status">
          <p>{{ notice }}</p>
          <button
            v-if="selection.error.value"
            type="button"
            class="lu-text-button"
            :disabled="disabled || selection.loading.value || selection.generating.value"
            @click="selection.retry"
          >
            重试载入
          </button>
        </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.lu-generation-model {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 200px;
  width: 200px;
  max-width: 220px;
  min-width: 0;
  height: 30px;
}
.lu-generation-model :deep(.formkit-outer),
.lu-generation-model :deep(.formkit-wrapper),
.lu-generation-model :deep(.formkit-inner) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 30px;
  min-height: 30px;
  margin: 0 !important;
  padding: 0 !important;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}
.lu-generation-model :deep(.formkit-outer) {
  flex: 1;
}
.lu-generation-model :deep(.formkit-inner > div) {
  min-width: 0;
  padding: 0 !important;
}
.lu-generation-model :deep(button[aria-haspopup='listbox']) {
  height: 30px;
  min-height: 30px;
  min-width: 0;
  max-width: 100%;
  gap: 0;
  padding: 0 8px;
  border: 1px solid var(--lu-border);
  border-radius: 7px;
  background: var(--lu-bg);
  color: var(--lu-text);
  font-size: 12px;
  line-height: 1.4;
}
.lu-generation-model :deep(button[aria-haspopup='listbox'] > span:first-of-type) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lu-generation-model :deep(button[aria-haspopup='listbox'] > svg),
.lu-generation-model :deep(button[aria-haspopup='listbox'] > img) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.lu-model-loading {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.lu-model-notice {
  position: static;
  flex-shrink: 0;
}
.lu-model-notice summary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 30px;
  color: var(--lu-danger);
  cursor: pointer;
  list-style: none;
}
.lu-model-notice summary::-webkit-details-marker {
  display: none;
}
.lu-model-notice-content {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 20;
  width: min(280px, calc(100vw - 48px));
  padding: 12px;
  border: 1px solid var(--lu-border);
  border-radius: 9px;
  background: var(--lu-bg);
  box-shadow: 0 6px 24px #00000012;
  color: var(--lu-muted);
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.lu-model-notice-content p {
  margin: 0;
}
</style>
