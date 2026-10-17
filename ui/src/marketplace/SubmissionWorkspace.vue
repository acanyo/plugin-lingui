<script setup lang="ts">
import type { InteractionRecording } from '../interaction-recordings/model'
import { onMounted, ref, shallowRef } from 'vue'
import { Dialog, Toast } from '@halo-dev/components'
import type { ComponentInstance } from '@lingui/renderer'
import SubmissionEditor from './SubmissionEditor.vue'
import SubmissionProjectDialog from './SubmissionProjectDialog.vue'
import SubmissionThemeDialog from './SubmissionThemeDialog.vue'
import MarketConnectionDialog from './MarketConnectionDialog.vue'
import SendSubmissionDialog from './SendSubmissionDialog.vue'
import RemoteSubmissions from './RemoteSubmissions.vue'
import {
  marketService,
  marketError,
  marketSite,
  marketName,
  type MarketConnection,
} from './market-service'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { localSubmissionRepository } from './draft-repository'
import {
  createSubmission,
  exportSubmission,
  importSubmission,
  type SubmissionDraft,
} from './submission'
import { downloadJson } from '../shared/download'
import { errorMessage } from '../services/repository'
const props = withDefaults(
  defineProps<{
    recordings?: InteractionRecording[]
    source?: ComponentInstance
    sourceDraft?: SubmissionDraft
    remoteEnabled?: boolean
  }>(),
  {
    remoteEnabled: true,
  },
)
const emit = defineEmits<{ workspace: []; themes: []; consumed: [] }>()
const drafts = shallowRef<SubmissionDraft[]>([]),
  active = shallowRef<SubmissionDraft>(),
  busy = ref(false),
  loading = ref(true),
  error = ref('')
const fileInput = ref<HTMLInputElement>()
const choosingProject = ref(false),
  choosingTheme = ref(false),
  pendingDraft = shallowRef<SubmissionDraft>()
const connection = shallowRef<MarketConnection>(),
  connectionError = ref(''),
  connecting = ref(false),
  connectionLoading = ref(false),
  sending = shallowRef<SubmissionDraft>(),
  remoteRefresh = ref(0)
async function loadConnection() {
  connectionLoading.value = true
  try {
    connection.value = await marketService.connection()
    connectionError.value = ''
  } catch (cause) {
    connectionError.value = marketError(cause)
  } finally {
    connectionLoading.value = false
  }
}
function connected(value: MarketConnection) {
  connection.value = value
  connecting.value = false
  connectionError.value = ''
  remoteRefresh.value++
  if (pendingDraft.value) {
    const draft = pendingDraft.value
    pendingDraft.value = undefined
    sendDraft(draft)
  }
}
function closeConnection() {
  connecting.value = false
  pendingDraft.value = undefined
}
function selectProject(draft: SubmissionDraft) {
  choosingProject.value = false
  choosingTheme.value = false
  edit(draft)
}
function openWorkspace() {
  choosingProject.value = false
  emit('workspace')
}
function openThemes() {
  choosingTheme.value = false
  emit('themes')
}
function disconnect() {
  Dialog.warning({
    title: '断开市场账号？',
    description: '已提交到市场的作品会保留，当前站点保存的令牌将删除。',
    confirmText: '断开连接',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        await marketService.disconnect()
        connection.value = undefined
        await loadConnection()
      } catch (cause) {
        connectionError.value = marketError(cause)
      }
    },
  })
}
function sendDraft(draft: SubmissionDraft) {
  if (!connection.value?.connected) {
    pendingDraft.value = draft
    connecting.value = true
    return
  }
  try {
    exportSubmission(draft)
    sending.value = draft
    error.value = ''
  } catch (cause) {
    active.value = draft
    error.value = marketError(cause)
  }
}
function checkRemote() {
  sending.value = undefined
  remoteRefresh.value++
}
function sent() {
  sending.value = undefined
  remoteRefresh.value++
  Toast.success('作品已提交到市场，等待审核')
}
function edit(draft: SubmissionDraft) {
  active.value = draft
  error.value = ''
}
function closeEditor() {
  active.value = undefined
  error.value = ''
}
async function refresh() {
  loading.value = true
  try {
    drafts.value = await localSubmissionRepository.list()
    error.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  void refresh()
  if (props.remoteEnabled) void loadConnection()
  if (props.sourceDraft) {
    active.value = props.sourceDraft
    emit('consumed')
  } else if (props.source) {
    active.value = createSubmission(props.source)
    emit('consumed')
  }
})
async function save(draft: SubmissionDraft, submitAfter = false) {
  if (busy.value) return
  busy.value = true
  try {
    if (submitAfter) exportSubmission(draft)
    const saved = await localSubmissionRepository.save(draft)
    active.value = undefined
    await refresh()
    if (submitAfter) sendDraft(saved)
    else Toast.success('投稿草稿已保存到当前浏览器')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}
function remove(draft: SubmissionDraft) {
  Dialog.warning({
    title: `删除“${draft.title}”草稿？`,
    description: '删除此浏览器中的投稿草稿，工作台项目不受影响。',
    confirmText: '删除草稿',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        await localSubmissionRepository.remove(draft.id, draft.revision)
        await refresh()
      } catch (cause) {
        error.value = errorMessage(cause)
      }
    },
  })
}
function exportWork(draft: SubmissionDraft) {
  try {
    downloadJson(`${draft.title}-作品包`, exportSubmission(draft))
    error.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
    active.value = draft
  }
}
async function importWork(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 524288) throw new Error('作品包不能超过 512 KiB')
    active.value = importSubmission(await file.text())
    error.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    input.value = ''
  }
}
</script>
<template>
  <section class="lu-submissions">
    <div class="lu-page-title">
      <div>
        <span class="lu-eyebrow">分享准备</span>
        <h1>投稿草稿</h1>
        <p class="lu-muted">分享组件或主题，整理草稿并跟进市场审核结果。</p>
      </div>
      <div class="lu-toolbar-actions">
        <button type="button" class="lu-button" @click="fileInput?.click()">导入作品包</button
        ><button type="button" class="lu-button" @click="choosingTheme = true">
          <LinguiIcon name="palette" /> 投稿主题</button
        ><button type="button" class="lu-button primary" @click="choosingProject = true">
          从我的项目选择 <LinguiIcon name="arrow" />
        </button>
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="lu-visually-hidden"
      aria-label="导入投稿作品包"
      @change="importWork"
    />
    <div class="lu-draft-notice lu-market-account">
      <LinguiIcon name="layers" />
      <div>
        <strong>社区市场 · {{ marketName }}</strong>
        <p v-if="!props.remoteEnabled">
          请在 Halo 工作台连接市场账号。本机模式保留草稿与作品包导出。
        </p>
        <p v-else-if="connectionLoading" role="status">正在检查账号连接…</p>
        <p v-else-if="connection?.connected">
          已连接 {{ connection.displayName || connection.username }}（{{
            connection.username
          }}）。投稿会保存到市场，审核并上架后公开。
        </p>
        <p v-else>浏览社区作品无需连接账号。连接你的市场账号后，可直接提交作品草稿。</p>
        <p v-if="connectionError" class="lu-error" role="alert">{{ connectionError }}</p>
      </div>
      <div class="lu-toolbar-actions">
        <template v-if="connection?.connected"
          ><button type="button" class="lu-button" @click="connecting = true">更换账号</button
          ><button type="button" class="lu-text-button" @click="disconnect">断开</button></template
        >
        <button
          v-else
          type="button"
          class="lu-button"
          :disabled="connectionLoading || !props.remoteEnabled"
          @click="connecting = true"
        >
          连接市场账号
        </button>
        <a
          :href="`${marketSite}/uc/lingui-submissions`"
          target="_blank"
          rel="noopener noreferrer"
          class="lu-text-button"
          >打开市场用户中心</a
        >
      </div>
    </div>
    <RemoteSubmissions
      v-if="connection?.connected"
      :key="connection.username"
      :refresh-token="remoteRefresh"
      @edit="edit"
    />
    <p v-if="error && !active" role="alert" class="lu-error">
      {{ error }} <button type="button" class="lu-text-button" @click="refresh">刷新列表</button>
    </p>
    <div class="lu-section-title">
      <h2>
        作品草稿 <span class="lu-count">{{ drafts.length }}</span>
      </h2>
      <button type="button" class="lu-text-button" @click="refresh">刷新</button>
    </div>
    <p v-if="loading" class="lu-muted" role="status">正在读取投稿草稿…</p>
    <div v-else-if="!drafts.length" class="lu-draft-empty">
      <LinguiIcon name="layers" />
      <h2>为你的第一件作品做准备</h2>
      <p>选择已保存的项目或主题，填写说明后准备投稿。</p>
      <div class="lu-toolbar-actions">
        <button type="button" class="lu-button" @click="choosingProject = true">选择我的项目</button
        ><button type="button" class="lu-button" @click="choosingTheme = true">选择我的主题</button>
      </div>
    </div>
    <div v-else class="lu-draft-list">
      <article v-for="draft in drafts" :key="draft.id">
        <span class="lu-project-symbol"
          ><LinguiIcon :name="draft.kind === 'theme' ? 'palette' : 'code'"
        /></span>
        <div class="lu-draft-name">
          <h3>{{ draft.title }}</h3>
          <p class="lu-muted">
            {{ draft.kind === 'theme' ? '主题' : '组件' }} · {{ draft.category }} · v{{
              draft.version || '未填写'
            }}
            · {{ new Date(draft.updatedAt).toLocaleDateString('zh-CN') }} 更新
          </p>
        </div>
        <span class="lu-draft-state">本机草稿</span>
        <div class="lu-toolbar-actions">
          <button
            type="button"
            class="lu-button primary"
            :disabled="!props.remoteEnabled"
            @click="sendDraft(draft)"
          >
            提交到市场</button
          ><button type="button" class="lu-button" @click="edit(draft)">编辑草稿</button
          ><button type="button" class="lu-text-button" @click="exportWork(draft)">导出</button
          ><button
            type="button"
            class="lu-text-button danger"
            :aria-label="`删除${draft.title}草稿`"
            @click="remove(draft)"
          >
            删除
          </button>
        </div>
      </article>
    </div>
    <SubmissionProjectDialog
      v-if="choosingProject"
      :author="connection?.displayName || connection?.username"
      @close="choosingProject = false"
      @selected="selectProject"
      @workspace="openWorkspace"
    />
    <MarketConnectionDialog v-if="connecting" @close="closeConnection" @connected="connected" />
    <SubmissionThemeDialog
      v-if="choosingTheme"
      :author="connection?.displayName || connection?.username"
      @close="choosingTheme = false"
      @selected="selectProject"
      @themes="openThemes"
    />
    <SendSubmissionDialog
      v-if="sending"
      :key="sending.id"
      :draft="sending"
      @close="sending = undefined"
      @sent="sent"
      @check="checkRemote"
    />
    <SubmissionEditor
      v-if="active"
      :key="active.id"
      :draft="active"
      :recordings="recordings"
      :busy="busy"
      :save-error="error"
      :remote-enabled="props.remoteEnabled"
      @save="save"
      @submit="save($event, true)"
      @close="closeEditor"
    />
  </section>
</template>
