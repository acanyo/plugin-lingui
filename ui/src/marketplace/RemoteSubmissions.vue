<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import StudioPagination from '../shared/StudioPagination.vue'
import {
  marketService,
  marketError,
  statusLabel,
  type MyMarketWork,
  type MyMarketDetail,
} from './market-service'
import type { SubmissionDraft } from './submission'
import RemoteSubmissionDetail from './RemoteSubmissionDetail.vue'
const props = defineProps<{ refreshToken: number }>()
const emit = defineEmits<{ edit: [draft: SubmissionDraft] }>()
const items = shallowRef<MyMarketWork[]>([]),
  detail = shallowRef<MyMarketDetail>(),
  page = ref(1),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  opening = ref('')
let generation = 0
async function load() {
  const seq = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await marketService.mine(page.value)
    if (seq === generation) {
      items.value = result.items ?? []
      total.value = result.total ?? 0
    }
  } catch (cause) {
    if (seq === generation) {
      error.value = marketError(cause)
      items.value = []
      total.value = 0
    }
  } finally {
    if (seq === generation) loading.value = false
  }
}
watch([page, () => props.refreshToken], load, { immediate: true })
function edit(draft: SubmissionDraft) {
  detail.value = undefined
  emit('edit', draft)
}
async function open(name?: string) {
  if (!name || opening.value) return
  opening.value = name
  try {
    detail.value = await marketService.detail(name)
  } catch (cause) {
    error.value = marketError(cause)
  } finally {
    opening.value = ''
  }
}
</script>
<template>
  <section class="lu-my-submissions" aria-label="我的市场投稿">
    <div class="lu-section-title">
      <h2>
        我的市场投稿 <span class="lu-count">{{ total }}</span>
      </h2>
      <button type="button" class="lu-text-button" :disabled="loading" @click="load">
        刷新审核结果
      </button>
    </div>
    <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="lu-muted" role="status">正在读取市场投稿…</p>
    <div v-else-if="!items.length" class="lu-draft-empty">
      <h3>还没有投稿</h3>
      <p>在下面选择作品草稿，点击「提交到市场」。</p>
    </div>
    <div v-else class="lu-draft-list">
      <article v-for="work in items" :key="work.name">
        <div class="lu-draft-name">
          <h3>{{ work.title }}</h3>
          <p class="lu-muted">
            v{{ work.version }} · {{ work.category
            }}<template v-if="work.publishedVersion">
              · 已上架 v{{ work.publishedVersion }}</template
            >
          </p>
        </div>
        <span class="lu-draft-state" :data-status="work.status">{{
          statusLabel(work.status)
        }}</span>
        <button type="button" class="lu-button" :disabled="!!opening" @click="open(work.name)">
          {{ opening === work.name ? '正在读取…' : '详情与审核意见' }}
        </button>
      </article>
    </div>
    <StudioPagination v-if="total > 9" v-model:page="page" :total="total" label="我的投稿分页" />
    <RemoteSubmissionDetail
      v-if="detail"
      :key="detail.name"
      :detail="detail"
      @close="detail = undefined"
      @changed="load"
      @edit="edit"
    />
  </section>
</template>
