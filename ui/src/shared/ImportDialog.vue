<script setup lang="ts">
import { ref } from 'vue'
import { VButton } from '@halo-dev/components'
import VModal from './StudioModal.vue'
import { type LinguiDocument, type ThemeTokens } from '@lingui/renderer'
import { parseGeneratedDesign } from '../ai-adapter/design-result'
const emit = defineEmits<{ imported: [document: LinguiDocument, theme?: ThemeTokens]; close: [] }>()
const text = ref(''),
  error = ref('')
function apply() {
  try {
    const design = parseGeneratedDesign(text.value)
    emit('imported', design.document, design.theme)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '导入失败'
  }
}
async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 262144) {
    error.value = '文件不能超过 256 KiB'
    return
  }
  text.value = await file.text()
}
</script>
<template>
  <VModal title="导入组件 JSON" :width="720" @close="emit('close')"
    ><div class="lingui-studio lu-dialog-body">
      <p class="lu-muted">
        支持 OpenUI 作品文档和带主题的设计结果。旧作品会先转换并校验，无法转换时保留原内容并提示原因。
      </p>
      <label class="lu-field"
        ><span>选择 JSON 文件</span
        ><input type="file" accept=".json,.jsonl,application/json" @change="upload" /></label
      ><textarea
        v-model="text"
        class="lu-code"
        rows="16"
        spellcheck="false"
        placeholder="粘贴你的 JSON…"
        aria-label="导入的 JSON 数据"
      />
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    </div>
    <template #footer
      ><VButton class="lu-button" @click="emit('close')">取消</VButton
      ><VButton class="lu-button primary" type="secondary" :disabled="!text.trim()" @click="apply"
        >校验并导入</VButton
      ></template
    ></VModal
  >
</template>
