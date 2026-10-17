<script setup lang="ts">
import { ref, computed } from 'vue'
import { VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import { marketService, marketError, statusLabel, type MyMarketDetail } from './market-service'
import { importSubmission, type SubmissionDraft } from './submission'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import { downloadJson } from '../shared/download'
const props = defineProps<{ detail: MyMarketDetail }>()
const emit = defineEmits<{ close: []; changed: []; edit: [draft: SubmissionDraft] }>()
const current = ref(props.detail),
  index = ref((props.detail.revisions?.length ?? 1) - 1),
  busy = ref(false),
  error = ref('')
const revision = computed(() => current.value.revisions?.[index.value])
const packageResult = computed(() => {
  try {
    return { draft: importSubmission(revision.value?.packageJson ?? ''), error: '' }
  } catch (cause) {
    return { draft: undefined, error: marketError(cause) }
  }
})
async function withdraw() {
  if (busy.value || !current.value.name || current.value.resourceVersion === undefined) return
  busy.value = true
  error.value = ''
  try {
    current.value = await marketService.withdraw(current.value.name, current.value.resourceVersion)
    emit('changed')
  } catch (cause) {
    error.value = marketError(cause)
  } finally {
    busy.value = false
  }
}
function exportWork() {
  if (revision.value?.packageJson)
    downloadJson(`${revision.value.title}-作品包`, JSON.parse(revision.value.packageJson))
}
</script>
<template>
  <VModal title="投稿详情与审核结果" :width="1040" :close-disabled="busy" @close="emit('close')">
    <div class="lingui-studio lu-remote-detail">
      <div class="lu-market-section-heading">
        <h2>{{ revision?.title }}</h2>
        <select v-model="index" aria-label="投稿版本">
          <option v-for="(item, i) in current.revisions" :key="item.id" :value="i">
            v{{ item.version }} · {{ statusLabel(item.status) }}
          </option>
        </select>
      </div>
      <p class="lu-muted">
        {{ statusLabel(revision?.status)
        }}<template v-if="current.publishedRevision === revision?.id"> · 当前上架版本</template>
      </p>
      <div v-if="revision?.reviewNote" class="lu-draft-notice">
        <div>
          <strong>审核意见</strong>
          <p>{{ revision.reviewNote }}</p>
        </div>
      </div>
      <p v-if="packageResult.error" class="lu-error" role="alert">
        作品暂时无法预览：{{ packageResult.error }}
      </p>
      <LinguiRenderer
        v-else-if="packageResult.draft"
        :key="revision?.id"
        :instance="packageResult.draft.instance"
      />
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
      <p v-if="revision?.status === 'PENDING'" class="lu-muted">
        撤回后可修改作品再投稿。已上架的历史版本仍保持公开。
      </p>
    </div>
    <template #footer>
      <VButton class="lu-button" :disabled="busy" @click="emit('close')">关闭</VButton>
      <VButton class="lu-button" :disabled="busy || !packageResult.draft" @click="exportWork"
        >导出作品包</VButton
      >
      <VButton
        class="lu-button"
        :disabled="busy || !packageResult.draft"
        @click="packageResult.draft && emit('edit', packageResult.draft)"
        >复制为修改草稿</VButton
      >
      <VButton
        class="lu-button"
        v-if="revision?.status === 'PENDING'"
        :disabled="busy"
        @click="withdraw"
        >{{ busy ? '正在撤回…' : '撤回待审版本' }}</VButton
      >
    </template>
  </VModal>
</template>
