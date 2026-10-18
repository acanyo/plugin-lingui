<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useId } from 'vue'
import { Dialog } from '@halo-dev/components'
import StudioModal from '../../shared/StudioModal.vue'
import LinguiRenderer from '../../shared/LinguiRenderer.vue'
import LinguiIcon from '../../shared/LinguiIcon.vue'
import ThemePreview from '../../theme-studio/ThemePreview.vue'
import { errorMessage } from '../../services/repository'
import type { DraftInfo, ActivityInfo, McpHistoryClient } from './client'
import type { DraftReview } from './review'
import DraftChangeReview from './DraftChangeReview.vue'
import { applyDraftSelection, defaultDraftSelection, type DraftSelection } from './changes'
import './inbox.css'

const props = defineProps<{
  drafts: DraftInfo[]
  activities: ActivityInfo[]
  loading: boolean
  busy: boolean
  applying?: boolean
  blockedReason?: string
  error: string
  client: McpHistoryClient
  load: (id: string) => Promise<DraftReview>
}>()
const emit = defineEmits<{
  close: []
  refresh: []
  apply: [review: DraftReview, asNew: boolean, selection?: DraftSelection]
  selection: []
}>()
const tab = ref<'drafts' | 'activity'>('drafts')
const search = ref('')
const filter = ref('all')
const review = shallowRef<DraftReview>()
const selected = ref('')
const loadingDetail = ref(false)
const detailError = ref('')
const asNew = ref(false)
const selection = shallowRef<DraftSelection>()
const currentPreview = ref<InstanceType<typeof LinguiRenderer>>()
const draftPreview = ref<InstanceType<typeof LinguiRenderer>>()
const locateMessage = ref('')
const merged = computed(() => {
  if (!review.value?.merge || asNew.value || !selection.value)
    return { instance: review.value?.instance, error: '' }
  try {
    return { instance: applyDraftSelection(review.value.merge, selection.value), error: '' }
  } catch (cause) {
    return { instance: undefined, error: errorMessage(cause) }
  }
})
function locate(id: string) {
  const foundDraft = draftPreview.value?.locateNode(id)
  const foundCurrent = currentPreview.value?.locateNode(id)
  locateMessage.value =
    foundDraft || foundCurrent
      ? `已定位组件 ${id}`
      : `组件 ${id} 当前不可见，可能位于收起或条件隐藏的内容中。`
}
const panelId = useId()
let sequence = 0
onBeforeUnmount(() => sequence++)
const visible = computed(() =>
  props.drafts.filter(
    (draft) =>
      (filter.value !== 'pending' || !draft.loadedAt) &&
      `${draft.title} ${draft.workName}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const pending = computed(() => props.drafts.filter((draft) => !draft.loadedAt).length)
async function select(draft: DraftInfo) {
  if (!draft.id || props.applying) return
  emit('selection')
  const token = ++sequence
  selected.value = draft.id
  review.value = undefined
  detailError.value = ''
  loadingDetail.value = true
  locateMessage.value = ''
  try {
    const result = await props.load(draft.id)
    if (token !== sequence) return
    review.value = result
    asNew.value = !result.info.workName || (!!result.conflict && !result.merge)
    selection.value = result.merge ? defaultDraftSelection(result.merge) : undefined
  } catch (cause) {
    if (token === sequence) detailError.value = errorMessage(cause)
  } finally {
    if (token === sequence) loadingDetail.value = false
  }
}
function remove() {
  const draft = review.value?.info
  if (!draft?.id || props.busy) return
  Dialog.warning({
    title: `删除草稿「${draft.title}」？`,
    description: '仅删除这份外部 AI 草稿，已保存的项目与版本保留。',
    confirmText: '删除草稿',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        await props.client.delete(draft.id!)
        sequence++
        review.value = undefined
        selected.value = ''
        emit('refresh')
      } catch (cause) {
        detailError.value = errorMessage(cause)
      }
    },
  })
}
const activityStatus = (status?: string) =>
  ({ success: '完成', 'needs-fix': '需要修正', error: '失败' })[status ?? ''] ?? '未知'
const historyDate = (value?: string) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
</script>
<template>
  <StudioModal
    title="外部 AI 草稿与记录"
    :width="1120"
    :close-disabled="applying"
    @close="emit('close')"
  >
    <section class="lingui-studio lu-mcp-inbox">
      <div class="lu-inbox-heading">
        <p class="lu-muted">草稿先预览、再载入，确认后保存。历史草稿可随时重新载入。</p>
        <button
          type="button"
          class="lu-button"
          :disabled="loading || busy"
          @click="emit('refresh')"
        >
          <LinguiIcon name="refresh" />刷新
        </button>
      </div>
      <div class="lu-inbox-tabs" role="tablist" aria-label="外部 AI 内容">
        <button
          :id="`${panelId}-draft-tab`"
          :aria-controls="`${panelId}-draft-panel`"
          type="button"
          role="tab"
          :aria-selected="tab === 'drafts'"
          @click="tab = 'drafts'"
        >
          创作草稿 <span>{{ pending }} 待处理</span>
        </button>
        <button
          :id="`${panelId}-activity-tab`"
          :aria-controls="`${panelId}-activity-panel`"
          type="button"
          role="tab"
          :aria-selected="tab === 'activity'"
          @click="tab = 'activity'"
        >
          操作记录
        </button>
      </div>
      <p v-if="error" class="lu-error" role="alert">{{ error }}</p>
      <p v-if="detailError" class="lu-error" role="alert">{{ detailError }}</p>
      <p v-if="busy" class="lu-muted" role="status">
        {{ blockedReason || '当前创作处理中，完成后可载入或删除草稿。' }}
      </p>
      <div
        v-if="tab === 'drafts'"
        :id="`${panelId}-draft-panel`"
        role="tabpanel"
        :aria-labelledby="`${panelId}-draft-tab`"
        class="lu-inbox-drafts"
      >
        <aside class="lu-inbox-sidebar">
          <FormKit
            v-model="search"
            name="external-draft-search"
            type="search"
            label="搜索草稿"
            placeholder="名称、项目或客户端"
            :delay="0"
          />
          <FormKit
            v-model="filter"
            name="external-draft-filter"
            type="select"
            label="显示范围"
            :options="[
              { label: '全部草稿', value: 'all' },
              { label: '待处理', value: 'pending' },
            ]"
            :delay="0"
          />
          <p v-if="loading && !drafts.length" class="lu-muted" role="status">正在读取草稿…</p>
          <p v-else-if="!visible.length" class="lu-inbox-empty">
            {{
              drafts.length
                ? '没有匹配的草稿。'
                : '还没有外部 AI 草稿。请在「工具 → MCP 服务」的访问密钥中选择 plugin-lingui__submit_design_draft，让 AI 调用它提交草稿。'
            }}
          </p>
          <nav v-else aria-label="外部 AI 草稿列表">
            <button
              v-for="draft in visible"
              :key="draft.id"
              type="button"
              :aria-pressed="draft.id === selected"
              :disabled="applying"
              @click="select(draft)"
            >
              <span class="lu-inbox-draft-type"
                >{{ draft.kind === 'theme' ? '主题' : '组件' }} ·
                {{ draft.loadedAt ? '已载入' : '待处理' }}</span
              >
              <strong>{{ draft.title }}</strong>
              <small>Halo MCP 服务 · {{ historyDate(draft.createdAt) }}</small>
              <small v-if="draft.workName"
                >{{ draft.workName }} · 基于 v{{ draft.baseRevision }}</small
              >
            </button>
          </nav>
        </aside>
        <div class="lu-inbox-detail" :aria-busy="loadingDetail">
          <p v-if="loadingDetail" class="lu-inbox-empty" role="status">正在读取并校验设计…</p>
          <template v-else-if="review">
            <header>
              <h3>{{ review.info.title }}</h3>
              <p class="lu-muted">{{ review.info.summary || 'AI 未附加修改说明。' }}</p>
            </header>
            <p v-if="review.conflict" class="lu-inbox-warning" role="status">
              {{ review.conflict }}
            </p>
            <FormKit
              v-if="review.info.workName && (!review.conflict || review.merge)"
              v-model="asNew"
              name="external-draft-as-new"
              type="checkbox"
              label="作为新作品载入，保留原项目"
              :delay="0"
            />
            <DraftChangeReview
              v-if="review.merge && selection && !asNew"
              :merge="review.merge"
              :selection="selection"
              :disabled="applying"
              @update="selection = $event"
              @locate="locate"
            />
            <details v-else open class="lu-inbox-changes">
              <summary>改动内容 · {{ review.changes.length }} 项</summary>
              <ul v-if="review.changes.length">
                <li v-for="change in review.changes" :key="change">{{ change }}</li>
              </ul>
              <p v-else class="lu-muted">与当前作品一致。</p>
            </details>
            <p v-if="merged.error" class="lu-inbox-warning" role="alert">
              所选修改暂时无法组合：{{ merged.error }}
            </p>
            <p v-if="locateMessage" class="lu-muted" role="status">{{ locateMessage }}</p>
            <p class="lu-muted lu-inbox-preview-help">
              此处预览不会调用业务接口或 JS 回调，载入后可在工作台测试。
            </p>
            <div
              v-if="review.instance"
              class="lu-inbox-previews"
              :class="{ 'has-base': !!review.base }"
            >
              <div v-if="review.base">
                <h4>当前项目</h4>
                <LinguiRenderer
                  :auto-start="false"
                  ref="currentPreview"
                  :key="`${selected}-base`"
                  :instance="review.base"
                />
              </div>
              <div>
                <h4>{{ review.merge && !asNew ? '采用所选修改后' : 'AI 草稿' }}</h4>
                <LinguiRenderer
                  :auto-start="false"
                  v-if="merged.instance"
                  ref="draftPreview"
                  :key="selected"
                  :instance="merged.instance"
                />
                <p v-else class="lu-muted">调整勾选后显示有效预览。</p>
              </div>
            </div>
            <ThemePreview v-else-if="review.theme" :theme="review.theme" />
          </template>
          <div v-else class="lu-inbox-empty">
            <LinguiIcon name="layers" />
            <p>选择一份草稿查看预览与改动。</p>
          </div>
        </div>
      </div>
      <section
        v-else
        :id="`${panelId}-activity-panel`"
        role="tabpanel"
        :aria-labelledby="`${panelId}-activity-tab`"
        class="lu-inbox-activity"
        aria-label="外部 AI 操作记录"
      >
        <p class="lu-muted">
          最近 300 条 MCP 操作。只记录实际工具调用，不包含外部 AI
          的思考或模型生成过程；不保存请求正文、密钥和完整设计。
        </p>
        <ol v-if="activities.length">
          <li v-for="activity in activities" :key="activity.id">
            <span class="lu-inbox-activity-status" :data-status="activity.status">{{
              activityStatus(activity.status)
            }}</span>
            <div>
              <strong>{{ activity.summary }}</strong>
              <p>
                <code>{{ activity.operation }}</code
                ><template v-if="activity.workName">
                  · 项目 <code>{{ activity.workName }}</code></template
                >
              </p>
              <small
                >Halo MCP 服务 · {{ historyDate(activity.createdAt) }} ·
                {{ activity.elapsedMs ?? 0 }} ms</small
              >
            </div>
          </li>
        </ol>
        <p v-else class="lu-inbox-empty">
          还没有外部 AI 操作记录。客户端连接后调用工具，记录会自动更新。
        </p>
      </section>
      <p class="lu-muted lu-inbox-retention">
        最多保留 100 份草稿，达到上限后请清理不需要的草稿。每 8 秒检查更新。
      </p>
    </section>
    <template #footer>
      <button
        v-if="tab === 'drafts' && review"
        type="button"
        class="lu-text-button"
        :disabled="busy"
        @click="remove"
      >
        删除草稿
      </button>
      <button type="button" class="lu-button" :disabled="applying" @click="emit('close')">
        返回工作台
      </button>
      <button
        v-if="tab === 'drafts'"
        type="button"
        class="lu-button primary"
        :disabled="busy || !review || loadingDetail || !!merged.error"
        @click="review && emit('apply', review, asNew, asNew ? undefined : selection)"
      >
        {{
          applying
            ? '正在载入…'
            : busy
              ? '当前创作处理中'
              : review?.theme
                ? '载入主题编辑器'
                : review?.info.loadedAt
                  ? '重新载入此版本'
                  : '确认并载入编辑'
        }}
      </button>
    </template>
  </StudioModal>
</template>
