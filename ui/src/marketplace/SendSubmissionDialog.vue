<script setup lang="ts">
import { onMounted, ref, shallowRef, computed } from 'vue'
import { VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import {
  marketService,
  marketError,
  marketName,
  statusLabel,
  type MyMarketWork,
} from './market-service'
import {
  exportSubmission,
  importSubmission,
  submissionKind,
  type SubmissionDraft,
} from './submission'
const props = defineProps<{ draft: SubmissionDraft }>()
const emit = defineEmits<{ close: []; sent: []; check: [] }>()
const busy = ref(false),
  loading = ref(true),
  error = ref(''),
  target = ref(''),
  sent = ref(false)
const works = shallowRef<MyMarketWork[]>([])
const targetPage = ref(1),
  targetTotal = ref(0),
  moreLoading = ref(false)
const selected = computed(() => works.value.find((w) => w.name === target.value))
const blocked = computed(
  () => selected.value?.status === 'PENDING' || selected.value?.status === 'ARCHIVED',
)
onMounted(async () => {
  try {
    exportSubmission(props.draft)
    const result = await marketService.mine(1)
    works.value = result.items ?? []
    targetTotal.value = result.total ?? 0
  } catch (cause) {
    error.value = marketError(cause)
  } finally {
    loading.value = false
  }
})
async function loadMoreTargets() {
  if (moreLoading.value) return
  moreLoading.value = true
  try {
    const result = await marketService.mine(targetPage.value + 1)
    targetPage.value++
    works.value = [...works.value, ...(result.items ?? [])]
    targetTotal.value = result.total ?? 0
  } catch (cause) {
    error.value = marketError(cause)
  } finally {
    moreLoading.value = false
  }
}
async function send() {
  if (busy.value || loading.value || blocked.value || sent.value) return
  busy.value = true
  error.value = ''
  try {
    let destination: { name: string; resourceVersion: number } | undefined
    if (target.value) {
      const detail = await marketService.detail(target.value)
      if (detail.resourceVersion === undefined || detail.archived)
        throw new Error('该作品不能投稿，请刷新我的投稿')
      if (detail.revisions?.some((r) => r.status === 'PENDING'))
        throw new Error('该作品已有待审版本，请等待审核或先撤回')
      const original = detail.revisions?.[0]?.packageJson
      if (original && submissionKind(importSubmission(original)) !== submissionKind(props.draft))
        throw new Error('组件与主题不能互相替换，请作为新作品投稿')
      destination = { name: target.value, resourceVersion: detail.resourceVersion }
    }
    await marketService.send(props.draft, destination)
    sent.value = true
    emit('sent')
  } catch (cause) {
    error.value = marketError(cause)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <VModal title="提交到社区市场" :width="580" :close-disabled="busy" @close="emit('close')">
    <div class="lingui-studio lu-market-connect">
      <p>
        <strong>{{ draft.title }}</strong> · {{ draft.kind === 'theme' ? '主题' : '组件' }} · v{{
          draft.version
        }}
      </p>
      <p class="lu-muted">
        作品将上传至{{ marketName }}。审核通过并上架后，其他用户才能在市场看到。
      </p>
      <p v-if="loading" role="status">正在检查作品信息与已有投稿…</p>
      <label v-else class="lu-market-target"
        >投稿目标
        <select v-model="target" :disabled="busy || sent" aria-label="投稿目标">
          <option value="">作为新作品投稿</option>
          <option v-for="work in works" :key="work.name" :value="work.name">
            {{ work.title }} · {{ statusLabel(work.status) }} · 提交新版本
          </option>
        </select>
      </label>
      <button
        v-if="works.length < targetTotal"
        type="button"
        class="lu-text-button"
        :disabled="busy || moreLoading"
        @click="loadMoreTargets"
      >
        {{ moreLoading ? '正在读取…' : '加载更多已有作品' }}
      </button>
      <p v-if="blocked" class="lu-error">
        {{
          selected?.status === 'PENDING'
            ? '该作品已有待审版本，请等待审核或先撤回。'
            : '该作品已归档，请先在市场恢复。'
        }}
      </p>
      <p v-else-if="target" class="lu-muted">
        已通过的版本需使用更高版本号；退回或撤回后可修改并重投原版本。已上架版本保持公开。
      </p>
      <p v-if="error" class="lu-error" role="alert">
        {{ error }}
        <button type="button" class="lu-text-button" @click="emit('check')">
          核对我的市场投稿
        </button>
      </p>
    </div>
    <template #footer>
      <VButton class="lu-button" :disabled="busy" @click="emit('close')">取消</VButton>
      <VButton type="secondary" :disabled="busy || loading || blocked || sent" @click="send">{{
        busy ? '正在提交…' : '确认投稿'
      }}</VButton>
    </template>
  </VModal>
</template>
