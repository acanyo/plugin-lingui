<script setup lang="ts">
import DesignCandidates from '../design-candidates/DesignCandidates.vue'
import type { CandidateSet } from '../design-candidates/model'
import InteractionRecordingPanel from '../interaction-recordings/InteractionRecordingPanel.vue'
import { useInteractionRecordings } from '../interaction-recordings/useInteractionRecordings'
import type { InteractionRecording } from '../interaction-recordings/model'
import RevisionDialog from '../revisions/RevisionDialog.vue'
import type { RevisionHistory } from '../revisions/types'
import { computed, ref, shallowRef, provide, useId, watch } from 'vue'
import type { ConversationState } from '../ai-adapter/conversation'
import type { ComponentInstance, LinguiDocument, ThemeTokens, JsonValue } from '@lingui/renderer'
import { responseSamplesKey } from '../data-binding/context'
import ReadinessDialog from '../integrations/ReadinessDialog.vue'
import IntegrationManager from '../integrations/IntegrationManager.vue'
import AiComposer from '../ai-adapter/AiComposer.vue'
import ComponentStudio from '../component-studio/ComponentStudio.vue'
import EmbedCodeDialog from '../component-embed/EmbedCodeDialog.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import LinguiIcon from '../shared/LinguiIcon.vue'
import PreviewPresentation from './PreviewPresentation.vue'
import WorkspaceToolbar from './WorkspaceToolbar.vue'
import { useStudioAccess } from '../services/studio-access'
import { cloneJson } from '../shared/clone'
import { updateInstanceDocument } from '../component-studio/document-editor'
import { useEventDebug } from '../component-studio/useEventDebug'
import EventDebugger from '../component-studio/EventDebugger.vue'
import { isDemoApi } from '@lingui/renderer'
import { useApiScenarios } from '../integrations/scenarios/useApiScenarios'
import ApiScenarioPanel from '../integrations/scenarios/ApiScenarioPanel.vue'
import InteractionCheckPanel from '../interaction-check/InteractionCheckPanel.vue'
import '../interaction-check/lab.css'
import type { CheckedDesign } from '../interaction-check/types'
import ObservedContracts from '../integrations/contracts/ObservedContracts.vue'
import type { BindingImpact } from '../integrations/contracts/impact'
import { endpointKey } from '../integrations/scenarios/model'
import SelectionBar from '../scoped-edit/SelectionBar.vue'
import { useEditSelection } from '../scoped-edit/useEditSelection'

const props = defineProps<{
  instance?: ComponentInstance
  themes: ThemeTokens[]
  dirty: boolean
  savedVersion?: number
  busy: boolean
  conflicted: boolean
  initialCandidates?: CandidateSet
  initialRecordings?: InteractionRecording[]
  initialEditing?: boolean
  initialConversation?: ConversationState
  historyStatus?: string
  revisions?: RevisionHistory
  canUndo?: boolean
  canRedo?: boolean
  externalDraftCount?: number
}>()
const emit = defineEmits<{
  candidates: [value: CandidateSet]
  recordings: [value: InteractionRecording[]]
  update: [instance: ComponentInstance]
  generated: [document: LinguiDocument, source?: ComponentInstance, theme?: ThemeTokens]
  busy: [value: boolean]
  save: []
  export: []
  import: []
  projects: []
  new: []
  blank: []
  submission: []
  resolve: [useGenerated: boolean]
  catalog: []
  themes: []
  fonts: []
  market: []
  history: []
  conversation: [value: ConversationState]
  editing: [value: boolean]
  undo: []
  redo: []
  restoreRevision: [id: string]
  externalDrafts: []
}>()
const access = useStudioAccess()
const showEmbed = ref(false)
const composerBusy = ref(false),
  candidateBusy = ref(false)
function setComposerBusy(value: boolean) {
  composerBusy.value = value
  publishBusy()
}
function setCandidateBusy(value: boolean) {
  candidateBusy.value = value
  publishBusy()
}
function publishBusy() {
  emit('busy', composerBusy.value || candidateBusy.value)
}
const apiScenarios = useApiScenarios(() => props.instance?.document)
const recordingController = useInteractionRecordings({
  instance: () => props.instance,
  initial: props.initialRecordings,
  reset: resetPreview,
  changed: (value) => emit('recordings', value),
})
const eventDebug = useEventDebug(
  () => apiScenarios.rules.value,
  (report) => {
    recordingController.observe(report)
    if (
      report.scope !== 'action' ||
      report.actionType !== 'api' ||
      report.phase !== 'success' ||
      !report.name ||
      report.result === undefined
    )
      return
    const api = props.instance?.document.integrations?.apis.find((api) => api.name === report.name)
    if (!api || isDemoApi(api)) return
    const rule = apiScenarios.rules.value[endpointKey(api.url, api.method)]
    if (!rule || rule.mode === 'real') rememberSample(api.name, report.result)
  },
)
watch(
  () => props.instance,
  () => {
    if (recordingController.recording.value) recordingController.stop()
  },
)
const composer = ref<InstanceType<typeof AiComposer>>()
const automaticCheck = shallowRef<CheckedDesign>()
function repairInteractions(instruction: string) {
  mobilePanel.value = 'chat'
  void composer.value?.repair(instruction)
}
function applyScenario(key: string, value: import('../integrations/scenarios/model').ApiScenario) {
  apiScenarios.apply(key, value)
  resetPreview()
}
function resetScenarios() {
  apiScenarios.reset()
  resetPreview()
}
const hasDemoApi = computed(() => props.instance?.document.integrations?.apis.some(isDemoApi))
const responseSamples = shallowRef<Record<string, JsonValue>>({})
provide(
  responseSamplesKey,
  computed(() => responseSamples.value),
)
watch(
  () => JSON.stringify(props.instance?.document.integrations),
  () => {
    responseSamples.value = {}
    eventDebug.resetDemo()
  },
)
function rememberSample(name: string, value: JsonValue) {
  responseSamples.value = { ...responseSamples.value, [name]: value }
}
const bindingFocus = shallowRef<BindingImpact>()
const presentation = ref<InstanceType<typeof PreviewPresentation>>()
const { selecting, editTarget, startSelecting, selectNode, cancelSelection } = useEditSelection({
  current: () => props.instance,
  blocked: () => props.busy || props.conflicted,
  showPreview: () => {
    mobilePanel.value = 'preview'
  },
  showComposer: () => {
    mobilePanel.value = 'chat'
    presentation.value?.close()
  },
  focusComposer: () => composer.value?.focus(),
})
function locateBinding(impact: BindingImpact) {
  managingIntegrations.value = false
  mobilePanel.value = 'preview'
  editing.value = true
  presentation.value?.editIfFullscreen()
  bindingFocus.value = { ...impact }
}
const managingIntegrations = ref(false)
function openMarket() {
  managingIntegrations.value = false
  emit('market')
}
function resetPreview() {
  eventDebug.resetDemo()
  responseSamples.value = {}
  reset.value++
}
const showRevisions = ref(false)
const showReadiness = ref(false)
const editing = ref(props.initialEditing ?? false)
watch(editing, (value) => emit('editing', value))
const viewport = ref<'desktop' | 'mobile'>('desktop')
const reset = ref(0)
const mobilePanel = ref<'chat' | 'preview'>('chat')
const panelId = useId()
const operationBlock = computed(() =>
  props.busy
    ? 'AI 正在创作，完成后可新建对话、撤销、重做或保存。'
    : props.conflicted
      ? '请先在预览区选择保留当前修改，或采用 AI 结果。'
      : '',
)
const undoReason = computed(
  () => operationBlock.value || (!props.canUndo ? '还没有可撤销的修改' : ''),
)
const redoReason = computed(
  () => operationBlock.value || (!props.canRedo ? '没有可重做的修改' : ''),
)
const status = computed(() =>
  props.busy
    ? 'AI 正在创作'
    : props.dirty
      ? '未保存'
      : props.savedVersion
        ? `已保存 · v${props.savedVersion}`
        : '创作空间',
)
const toolbarActions = {
  projects: () => emit('projects'),
  new: () => emit('new'),
  undo: () => emit('undo'),
  redo: () => emit('redo'),
  save: () => emit('save'),
  history: () => emit('history'),
  externalDrafts: () => emit('externalDrafts'),
  revisions: () => {
    showRevisions.value = true
  },
  readiness: () => {
    showReadiness.value = true
  },
  export: () => emit('export'),
  embed: () => {
    showEmbed.value = true
  },
  submission: () => emit('submission'),
}
function rename(event: Event) {
  if (!props.instance) return
  const title = (event.target as HTMLInputElement).value.trim()
  if (title)
    emit('update', updateInstanceDocument(props.instance, { ...props.instance.document, title }))
}
function changeTheme(event: Event) {
  const theme = props.themes.find((item) => item.id === (event.target as HTMLSelectElement).value)
  if (theme && props.instance) emit('update', { ...props.instance, theme: cloneJson(theme) })
}
</script>
<template>
  <section
    class="lu-creation-workspace"
    aria-label="AI 开发工作台"
    @keydown.esc="cancelSelection($event)"
  >
    <EmbedCodeDialog v-if="showEmbed && instance" :instance="instance" @close="showEmbed = false" />
    <WorkspaceToolbar
      :title="instance?.document.title"
      :status="status"
      :dirty="dirty"
      :busy="busy"
      :operation-block="operationBlock"
      :can-save="access.allows('components:manage')"
      :saved-version="savedVersion"
      :has-revisions="!!revisions"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :undo-reason="undoReason"
      :redo-reason="redoReason"
      :external-draft-count="externalDraftCount"
      @rename="rename"
      @action="toolbarActions[$event]()"
    >
      <template v-if="$slots.insert" #insert><slot name="insert" /></template>
    </WorkspaceToolbar>
    <p v-if="operationBlock" class="lu-operation-hint" role="status">{{ operationBlock }}</p>
    <nav class="lu-mobile-workspace-nav" aria-label="工作区视图">
      <button
        type="button"
        :aria-pressed="mobilePanel === 'chat'"
        :aria-controls="`${panelId}-chat`"
        @click="mobilePanel = 'chat'"
      >
        <LinguiIcon name="sparkles" />AI 对话
      </button>
      <button
        type="button"
        :aria-pressed="mobilePanel === 'preview'"
        :aria-controls="`${panelId}-preview`"
        @click="mobilePanel = 'preview'"
      >
        <LinguiIcon name="layers" />实时预览
        <span v-if="instance" class="lu-status-dot" aria-hidden="true" />
      </button>
    </nav>
    <div class="lu-creation-grid" :data-panel="mobilePanel">
      <div :id="`${panelId}-chat`" class="lu-chat-column">
        <AiComposer
          ref="composer"
          :instance="instance"
          :dirty="dirty"
          :blocked="conflicted || candidateBusy"
          :initial-conversation="initialConversation"
          :edit-target="editTarget"
          @edit-target="editTarget = $event"
          @reselect="startSelecting"
          @generated="(document, source, theme) => emit('generated', document, source, theme)"
          @busy="setComposerBusy"
          @import="emit('import')"
          @conversation="emit('conversation', $event)"
          @checked="automaticCheck = $event"
        />
        <DesignCandidates
          :instance="instance"
          :initial="initialCandidates"
          :blocked="conflicted || composerBusy"
          @changed="emit('candidates', $event)"
          @busy="setCandidateBusy"
          @adopt="(document, source, theme) => emit('generated', document, source, theme)"
        />
        <nav class="lu-creation-resources" aria-label="创作资源">
          <button
            type="button"
            title="配置 API 与 JS 回调，也可以先配置再让 AI 创作"
            @click="managingIntegrations = true"
          >
            <LinguiIcon name="code" />接口与回调
          </button>
          <button type="button" @click="emit('catalog')"><LinguiIcon name="grid" />基础组件</button>
          <button type="button" @click="emit('themes')">
            <LinguiIcon name="palette" />主题样式
          </button>
          <button type="button" @click="emit('fonts')"><LinguiIcon name="book" />字体管理</button>
          <button type="button" @click="emit('market')">
            <LinguiIcon name="layers" />组件市场
          </button>
        </nav>
      </div>
      <PreviewPresentation
        ref="presentation"
        :id="`${panelId}-preview`"
        v-slot="{ fullscreen, mode, open, toggle }"
      >
        <section
          :class="[
            'lu-artifact-panel',
            { 'is-fullscreen': fullscreen, 'is-fullscreen-edit': fullscreen && mode === 'edit' },
          ]"
          aria-label="组件预览与编辑"
        >
          <header class="lu-artifact-toolbar">
            <span class="lu-inline-icon"
              ><span :class="['lu-status-dot', { 'is-idle': !instance }]" />{{
                fullscreen && mode === 'edit' ? '编辑与预览' : '实时预览'
              }}</span
            >
            <div v-if="instance" class="lu-artifact-actions">
              <button
                type="button"
                :class="['lu-button', { 'is-selected': selecting }]"
                :aria-pressed="selecting"
                :disabled="busy || conflicted"
                :title="busy || conflicted ? operationBlock : '点击预览中的组件，让 AI 局部修改'"
                @click="selecting ? (selecting = false) : startSelecting()"
              >
                <LinguiIcon name="edit" />{{ selecting ? '退出选取' : '选取修改' }}
              </button>
              <div class="lu-segment" aria-label="预览尺寸">
                <button
                  type="button"
                  :class="{ active: viewport === 'desktop' }"
                  :aria-pressed="viewport === 'desktop'"
                  @click="viewport = 'desktop'"
                >
                  桌面
                </button>
                <button
                  type="button"
                  :class="{ active: viewport === 'mobile' }"
                  :aria-pressed="viewport === 'mobile'"
                  @click="viewport = 'mobile'"
                >
                  手机
                </button>
              </div>
              <button
                v-if="!fullscreen"
                type="button"
                :class="['lu-button', { 'is-selected': editing }]"
                :aria-expanded="editing"
                aria-controls="lu-manual-editor"
                @click="editing = !editing"
              >
                <LinguiIcon name="code" />{{ editing ? '收起编辑' : '手动编辑' }}
              </button>
              <button
                v-if="fullscreen"
                type="button"
                class="lu-button"
                @click="open(mode === 'edit' ? 'preview' : 'edit')"
              >
                <LinguiIcon :name="mode === 'edit' ? 'layers' : 'code'" />{{
                  mode === 'edit' ? '只看预览' : '手动编辑'
                }}
              </button>
              <button
                type="button"
                class="lu-icon-button lu-preview-expand"
                data-preview-fullscreen
                :aria-label="
                  fullscreen ? (mode === 'edit' ? '退出全屏编辑' : '退出全屏预览') : '全屏预览'
                "
                :title="fullscreen ? '退出全屏 · Esc' : '全屏预览'"
                @click="toggle"
              >
                <LinguiIcon :name="fullscreen ? 'shrink' : 'expand'" />
              </button>
            </div>
            <span v-else class="lu-muted">生成后在这里试用</span>
          </header>
          <SelectionBar
            v-if="selecting && instance"
            :instance="instance"
            @select="selectNode"
            @cancel="selecting = false"
          />
          <div v-if="conflicted" class="lu-ai-conflict" role="status">
            <p>生成期间你手动修改了组件。选择保留当前内容，或采用 AI 结果。</p>
            <button type="button" class="lu-button" @click="emit('resolve', false)">
              保留我的修改
            </button>
            <button type="button" class="lu-button primary" @click="emit('resolve', true)">
              采用 AI 结果
            </button>
          </div>
          <p v-if="hasDemoApi" class="lu-api-workspace-hint" role="status">
            当前作品含本地模拟接口，可直接试用。连接自己的服务或发布前，请在<button
              type="button"
              class="lu-text-button"
              @click="managingIntegrations = true"
            >
              接口与回调</button
            >替换地址后验证真实数据。
          </p>
          <div
            :class="[
              'lu-artifact-scroll',
              {
                'is-editing':
                  instance && ((editing && !fullscreen) || (fullscreen && mode === 'edit')),
              },
            ]"
          >
            <template v-if="instance">
              <div class="lu-artifact-canvas lu-canvas">
                <div class="lu-artifact-meta">
                  <span>{{ instance.document.title }}</span>
                  <select :value="instance.theme.id" aria-label="预览主题" @change="changeTheme">
                    <option v-for="theme in themes" :key="theme.id" :value="theme.id">
                      {{ theme.name }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="lu-text-button"
                    @click="resetPreview"
                    aria-label="重置预览"
                  >
                    <LinguiIcon name="refresh" />
                  </button>
                </div>
                <div
                  :class="['lu-preview-frame', { 'lu-preview-mobile': viewport === 'mobile' }]"
                  :style="{
                    background: instance.theme.colors.background,
                    borderRadius: `${instance.theme.radius * 1.25}px`,
                  }"
                >
                  <LinguiRenderer
                    :key="reset"
                    :instance="instance"
                    :interactions="eventDebug.interactions.value"
                    :selecting="selecting"
                    :selected-node="editTarget?.nodeId"
                    @select="selectNode"
                    @cancel-selection="selecting = false"
                  />
                </div>
                <p class="lu-canvas-hint">
                  {{
                    apiScenarios.active.value
                      ? `正在模拟 ${apiScenarios.active.value} 个接口 · 预览中的交互不会改变初始状态`
                      : '预览中的交互不会改变初始状态。'
                  }}
                </p>
                <ApiScenarioPanel
                  :targets="apiScenarios.targets.value"
                  :rules="apiScenarios.rules.value"
                  :active="apiScenarios.active.value"
                  @apply="applyScenario"
                  @reset="resetScenarios"
                />
                <InteractionCheckPanel
                  :instance="instance"
                  :rules="apiScenarios.rules.value"
                  :automatic-check="automaticCheck"
                  :blocked="busy || conflicted"
                  @repair="repairInteractions"
                />
                <ObservedContracts
                  :document="instance.document"
                  :samples="responseSamples"
                  @locate="locateBinding"
                />
                <InteractionRecordingPanel
                  v-if="instance"
                  :controller="recordingController"
                  :instance="instance"
                  :rules="apiScenarios.rules.value"
                />
                <EventDebugger :reports="eventDebug.reports.value" @clear="eventDebug.clear" />
              </div>
              <div
                v-show="(editing && !fullscreen) || (fullscreen && mode === 'edit')"
                id="lu-manual-editor"
                class="lu-manual-editor"
              >
                <div class="lu-manual-heading">
                  <strong>手动调整</strong>
                  <button
                    v-show="!fullscreen"
                    type="button"
                    class="lu-text-button"
                    @click="open('edit')"
                  >
                    <LinguiIcon name="expand" />全屏编辑
                  </button>
                  <span v-if="fullscreen">修改实时同步到预览</span>
                </div>
                <ComponentStudio
                  :binding-focus="bindingFocus"
                  :event-debug="eventDebug"
                  :instance="instance"
                  :themes="themes"
                  compact
                  @update="emit('update', $event)"
                />
              </div>
            </template>
            <div v-else class="lu-artifact-empty">
              <div class="lu-empty-artifact" aria-hidden="true">
                <LinguiIcon name="layers" /><span /><span /><i />
              </div>
              <h2>{{ busy ? '正在把想法变成组件…' : '你的作品会出现在这里' }}</h2>
              <p>
                {{
                  busy
                    ? '完成后可以直接试用，也可以继续对话修改。'
                    : '从左侧开始对话，生成后即可预览和编辑。'
                }}
              </p>
              <button
                type="button"
                class="lu-button"
                :disabled="busy"
                :title="busy ? operationBlock : undefined"
                :aria-description="busy ? operationBlock : undefined"
                @click="emit('blank')"
              >
                从空白组件开始
              </button>
            </div>
          </div>
          <footer class="lu-artifact-footer">
            <span>{{ instance ? 'AI 与手动编辑共用当前作品' : '支持 AI 创作与手动编辑' }}</span
            ><span role="status">{{ historyStatus || '主动保存后加入项目' }}</span>
          </footer>
        </section>
      </PreviewPresentation>
    </div>
    <ReadinessDialog
      v-if="showReadiness && instance"
      :instance="instance"
      @close="showReadiness = false"
    />
    <RevisionDialog
      v-if="showRevisions"
      :history="revisions"
      :current="instance"
      :busy="busy || conflicted"
      @close="showRevisions = false"
      @restore="emit('restoreRevision', $event)"
    />
    <IntegrationManager
      v-if="managingIntegrations"
      :instance="instance"
      @sample="rememberSample"
      @update="emit('update', $event)"
      @close="managingIntegrations = false"
      @market="openMarket"
      @locate="locateBinding"
    />
  </section>
</template>
