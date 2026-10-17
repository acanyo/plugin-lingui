<script setup lang="ts">
import { computed, ref, shallowRef, watch, onUnmounted, nextTick, useId } from 'vue'
import { remixSources, type WorkSource } from '../remix/provenance'
import MarketKindTabs, { type MarketKind } from './MarketKindTabs.vue'
import StudioPagination from '../shared/StudioPagination.vue'
import type { ComponentInstance, ThemeTokens } from '@lingui/renderer'
import { workInstance, type MarketplaceWork } from './catalog'
import {
  marketService,
  marketError,
  marketSite,
  marketName,
  type CommunityWork,
} from './market-service'
import CommunityWorkCard from './CommunityWorkCard.vue'
import WorkDetail from './WorkDetail.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import StudioSearch from '../shared/StudioSearch.vue'
const props = defineProps<{ download?: boolean; actionDisabled?: boolean }>()
const emit = defineEmits<{
  use: [instance: ComponentInstance, sources?: WorkSource[]]
  theme: [theme: ThemeTokens]
  drafts: []
  download: [work: MarketplaceWork]
}>()
const works = shallowRef<CommunityWork[]>([]),
  selected = shallowRef<MarketplaceWork>(),
  search = ref(''),
  page = ref(1),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  useError = ref('')
const kind = ref<MarketKind>('component')
const counts = ref<Record<MarketKind, number | undefined>>({
  component: undefined,
  theme: undefined,
})
const panelId = `market-kind-${useId()}`
const kindLabel = computed(() => (kind.value === 'theme' ? '主题' : '组件'))
let generation = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  trigger: HTMLElement | undefined
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  works.value = []
  try {
    const result = await marketService.list(page.value, search.value.trim(), kind.value)
    if (current === generation) {
      works.value = result.items ?? []
      total.value = result.total ?? 0
      counts.value = { component: result.componentTotal, theme: result.themeTotal }
    }
  } catch (cause) {
    if (current === generation) {
      error.value = marketError(cause)
      total.value = 0
      counts.value = { component: undefined, theme: undefined }
    }
  } finally {
    if (current === generation) loading.value = false
  }
}
watch([page, kind], load, { immediate: true })
function selectKind(value: MarketKind) {
  if (kind.value === value) return
  clearTimeout(timer)
  generation++
  works.value = []
  page.value = 1
  kind.value = value
}
watch(search, () => {
  clearTimeout(timer)
  generation++
  loading.value = true
  works.value = []
  counts.value = { component: undefined, theme: undefined }
  timer = setTimeout(() => {
    if (page.value === 1) void load()
    else page.value = 1
  }, 300)
})
onUnmounted(() => {
  generation++
  clearTimeout(timer)
})
function preview(work: MarketplaceWork) {
  trigger = document.activeElement as HTMLElement
  selected.value = work
}
function useWork(work: MarketplaceWork) {
  if (props.actionDisabled) return
  if (props.download) {
    if (work.kind !== 'theme') emit('download', work)
    return
  }
  const instance = workInstance(work)
  if (work.kind === 'theme') emit('theme', instance.theme)
  else {
    try {
      emit('use', instance, remixSources(work, marketSite))
      useError.value = ''
    } catch (cause) {
      useError.value = cause instanceof Error ? cause.message : '此作品未明确允许改编'
    }
  }
}
async function close() {
  selected.value = undefined
  await nextTick()
  if (trigger?.isConnected) trigger.focus({ preventScroll: true })
}
</script>
<template>
  <section aria-label="市场作品">
    <div class="lu-market-section-heading">
      <MarketKindTabs
        v-if="!download"
        :model-value="kind"
        :counts="counts"
        :panel-id="panelId"
        @update:model-value="selectKind"
      />
      <h3 v-else>发现交互组件</h3>
      <div class="lu-market-controls">
        <StudioSearch
          v-model="search"
          class="lu-market-search"
          label="搜索市场作品"
          :placeholder="`搜索${kindLabel}、作者、分类…`"
        />
        <button type="button" class="lu-button" :disabled="loading" @click="load">刷新</button>
      </div>
    </div>
    <p v-if="useError" role="alert" class="lu-error">{{ useError }}</p>
    <p class="lu-muted lu-community-source">
      来自 <a :href="marketSite" target="_blank" rel="noopener noreferrer">{{ marketName }}</a> ·
      只展示已审核并上架的作品
    </p>
    <div
      :id="panelId"
      :role="download ? 'region' : 'tabpanel'"
      :aria-label="download ? '可下载的组件' : undefined"
      :aria-labelledby="download ? undefined : `${panelId}-${kind}`"
      :aria-busy="loading"
      tabindex="0"
    >
      <div v-if="error" class="lu-market-empty" role="alert">
        <LinguiIcon name="info" />
        <h3>暂时无法读取市场作品</h3>
        <p>{{ error }}</p>
        <button type="button" class="lu-button" @click="load">重试</button>
      </div>
      <p v-else-if="loading" class="lu-community-loading" role="status">正在读取{{ kindLabel }}…</p>
      <div v-else-if="works.length" class="lu-builtin-grid">
        <CommunityWorkCard
          v-for="work in works"
          :key="work.name"
          :work="work"
          :action-label="download ? '下载到我的项目' : undefined"
          :action-disabled="actionDisabled"
          @preview="preview"
          @use="useWork"
        />
      </div>
      <div v-else class="lu-market-empty">
        <LinguiIcon :name="kind === 'theme' ? 'palette' : 'layers'" />
        <h3>{{ search ? `没有找到匹配的${kindLabel}` : `暂无已上架${kindLabel}` }}</h3>
        <p>{{ search ? '试试其他关键词。' : '投稿经审核并上架后，会出现在这里。' }}</p>
        <button
          v-if="search || !download"
          type="button"
          class="lu-button"
          @click="search ? (search = '') : $emit('drafts')"
        >
          {{ search ? '清空搜索' : '准备投稿' }}
        </button>
      </div>
      <StudioPagination
        v-if="total > 9 && !loading && !error"
        v-model:page="page"
        :total="total"
        :label="`市场${kindLabel}分页`"
      />
    </div>
    <WorkDetail
      v-if="selected"
      :key="selected.id"
      :work="selected"
      :download="download"
      :action-disabled="actionDisabled"
      @back="close"
      @use="useWork(selected)"
    />
  </section>
</template>
