<script setup lang="ts">
import type { GeneratedDesign } from './design-result'
import type { InteractionCheck } from '../interaction-check/types'
import { computed } from 'vue'
import { createInstance } from '@lingui/renderer'
import StudioModal from '../shared/StudioModal.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import { downloadJson } from '../shared/download'
const props = defineProps<{ draft: GeneratedDesign; check?: InteractionCheck }>()
const emit = defineEmits<{ close: []; adopt: [] }>()
const instance = computed(() => ({
  ...createInstance(props.draft.document),
  ...(props.draft.theme ? { theme: props.draft.theme } : {}),
}))
function download() {
  downloadJson('lingui-repair-draft', props.draft)
}
</script>
<template>
  <StudioModal title="待修复草稿" :width="1000" @close="emit('close')">
    <section class="lingui-studio lu-failed-draft">
      <p class="lu-muted">
        此草稿尚未通过检查，当前作品仍保留。这里仅作预览；采用后可手动修改或继续让 AI 修复。
      </p>
      <ul v-if="check?.issues.length" class="lu-draft-issues">
        <li v-for="(issue, index) in check.issues" :key="index">
          <code>{{ issue.nodeId }}</code
          >：{{ issue.message }}
        </li>
      </ul>
      <LinguiRenderer
        :auto-start="false"
        :instance="instance"
        :interactions="{ inheritRegistered: false, requests: { allow: () => false } }"
      />
    </section>
    <template #footer>
      <button type="button" class="lu-button" @click="download">下载草稿 JSON</button>
      <button type="button" class="lu-button" @click="emit('close')">保留当前作品</button>
      <button type="button" class="lu-button primary" @click="emit('adopt')">
        采用草稿继续编辑
      </button>
    </template>
  </StudioModal>
</template>
<style scoped>
.lu-failed-draft {
  padding: 0 24px 24px;
}
.lu-draft-issues {
  max-height: 200px;
  overflow: auto;
  padding: 16px 24px;
  font-size: 13px;
  color: var(--lu-muted);
}
</style>
