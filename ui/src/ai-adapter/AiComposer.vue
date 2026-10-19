<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { ComponentInstance, LinguiDocument, ThemeTokens } from '@lingui/renderer'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { useRepository } from '../services/repository'
import { useStudioAccess } from '../services/studio-access'
import ExternalAiDialog from '../mcp/ExternalAiDialog.vue'
import { useAiConversation } from './useAiConversation'
import type { ConversationState, GenerationMode } from './conversation'
import { cloneJson } from '../shared/clone'
import GenerationProgress from './progress/GenerationProgress.vue'
import './progress/progress.css'
import type { CheckedDesign } from '../interaction-check/types'
import FailedGenerationDialog from './FailedGenerationDialog.vue'
import type { ConversationMessage } from './conversation'
import EditTargetCard from '../scoped-edit/EditTargetCard.vue'
import EditProposalReview from '../scoped-edit/EditProposalReview.vue'
import type { EditTarget } from '../scoped-edit/model'
import GenerationModelSelector from '../model-selection/GenerationModelSelector.vue'
import { useModelSelectionActivity, useWorkbenchModelSelection } from '../model-selection/context'

const props = defineProps<{
  instance?: ComponentInstance
  blocked?: boolean
  dirty?: boolean
  initialConversation?: ConversationState
  editTarget?: EditTarget
  candidateBusy?: boolean
  canGenerateMultiple?: boolean
  hasCandidates?: boolean
}>()
const emit = defineEmits<{
  generated: [document: LinguiDocument, source?: ComponentInstance, theme?: ThemeTokens]
  import: []
  busy: [value: boolean]
  conversation: [value: ConversationState]
  checked: [value: CheckedDesign]
  editTarget: [value: EditTarget | undefined]
  reselect: []
  multiple: [instruction: string]
  stopCandidates: []
}>()
const repository = useRepository()
const access = useStudioAccess()
const modelSelection = useWorkbenchModelSelection()
const modelReady = computed(() => modelSelection?.ready.value ?? true)
const instruction = ref(props.initialConversation?.instruction ?? '')
const generationMode = ref<GenerationMode>(props.initialConversation?.generationMode ?? 'single')
const connectingExternalAi = ref(false)
const failedDraft = shallowRef<ConversationMessage>()
function adoptFailedDraft() {
  const draft = failedDraft.value?.draft
  if (!draft || failedDraft.value?.editTarget || working.value || props.blocked) return
  emit('generated', draft.document, props.instance, draft.theme)
  failedDraft.value = undefined
}
const log = ref<HTMLElement>()
const input = ref<HTMLTextAreaElement>()
const followProgress = ref(true)
function trackScroll() {
  if (log.value)
    followProgress.value =
      log.value.scrollHeight - log.value.scrollTop - log.value.clientHeight < 56
}
const { messages, busy, send, stop } = useAiConversation(
  repository,
  () => props.instance,
  (document, source, theme) => emit('generated', document, source, theme),
  props.initialConversation?.messages,
  (value) => emit('checked', value),
)
useModelSelectionActivity(busy)
const working = computed(() => busy.value || !!props.candidateBusy)
watch(
  () => props.editTarget,
  (target) => {
    if (target) generationMode.value = 'single'
  },
  { immediate: true },
)
const reviewing = ref<number>()
const reviewMessage = computed(() =>
  messages.value.find((message) => message.id === reviewing.value),
)
function finishProposal(state: 'adopted' | 'discarded') {
  messages.value = messages.value.map((message) =>
    message.id === reviewing.value && message.editProposal
      ? { ...message, editProposal: { ...message.editProposal, state } }
      : message,
  )
  reviewing.value = undefined
}
function adoptProposal(result: ComponentInstance, source: ComponentInstance, check: CheckedDesign) {
  if (working.value || props.blocked || reviewMessage.value?.editProposal?.state !== 'pending')
    return
  emit('generated', result.document, source)
  emit('checked', check)
  finishProposal('adopted')
}
const canGenerate = computed(() => repository.mode === 'halo' && access.allows('ai:generate'))
const sendDisabledReason = computed(() =>
  working.value
    ? 'AI 正在生成，请完成后再发送'
    : !modelReady.value
      ? '正在载入生成模型，请稍后'
      : props.blocked
        ? '请先选择保留当前修改，或采用 AI 结果'
        : generationMode.value === 'multiple' && instruction.value.length > 3400
          ? '多方案需求最多 3400 字，请缩短后发送，或切回单方案。'
          : !instruction.value.trim()
            ? '请先输入组件创作需求'
            : '',
)
const suggestions = [
  {
    title: '知识测验',
    text: '做一个 JVM 内存知识测验，选择答案后显示解析，支持重新作答。',
    icon: 'book',
  },
  {
    title: '参数计算器',
    text: '做一个阅读时间计算器，可以调整文章字数和阅读速度，即时显示预计阅读分钟数。',
    icon: 'calculator',
  },
  {
    title: '交互式架构图',
    text: '做一个 JVM 内存架构图，点击堆内存后展开年轻代和老年代，并显示用途说明。',
    icon: 'layers',
  },
]

watch(busy, (value) => emit('busy', value))
watch(
  [messages, instruction, generationMode],
  () =>
    emit(
      'conversation',
      cloneJson({
        messages: messages.value,
        instruction: instruction.value,
        generationMode: generationMode.value,
      }),
    ),
  { deep: true },
)
watch(
  [messages, busy],
  async () => {
    await nextTick()
    if (log.value && followProgress.value) log.value.scrollTop = log.value.scrollHeight
  },
  { immediate: true, deep: true },
)

async function submitSingle(
  text = instruction.value,
  options: { target?: EditTarget } = { target: props.editTarget },
) {
  if (
    !canGenerate.value ||
    !modelReady.value ||
    working.value ||
    props.blocked ||
    !text.trim() ||
    text.length > 4000
  )
    return
  followProgress.value = true
  if (text === instruction.value) instruction.value = ''
  await send(text, options.target)
  await nextTick()
  input.value?.focus()
}
function setGenerationMode(mode: GenerationMode) {
  if (working.value || props.blocked || (mode === 'multiple' && props.editTarget)) return
  generationMode.value = mode
}
function submit() {
  if (generationMode.value === 'single' || props.editTarget) return submitSingle()
  if (
    !props.canGenerateMultiple ||
    !canGenerate.value ||
    !modelReady.value ||
    working.value ||
    props.blocked ||
    !instruction.value.trim() ||
    instruction.value.length > 3400
  )
    return
  emit('multiple', instruction.value.trim())
}
function stopAll() {
  stop()
  emit('stopCandidates')
}
function keydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
  if (!canGenerate.value || working.value || props.blocked) return
  event.preventDefault()
  void submit()
}
function choose(text: string) {
  instruction.value = text
  input.value?.focus()
}
function importExternalResult() {
  connectingExternalAi.value = false
  emit('import')
}
defineExpose({
  repair: (instruction: string) => submitSingle(instruction, {}),
  focus: () => input.value?.focus(),
})
</script>
<template>
  <section class="lu-ai-chat" aria-label="AI 创作对话">
    <header class="lu-chat-heading">
      <span class="lu-inline-icon"><LinguiIcon name="sparkles" /><strong>AI 创作</strong></span>
      <span class="lu-muted">{{ instance ? '围绕当前组件继续对话' : '从一个想法开始' }}</span>
    </header>
    <div
      ref="log"
      class="lu-conversation"
      :class="{ 'is-empty': !messages.length && !hasCandidates }"
      role="log"
      @scroll="trackScroll"
      aria-label="创作对话记录"
      aria-live="polite"
    >
      <div v-if="!messages.length && !hasCandidates" class="lu-chat-welcome">
        <span class="lu-chat-mark"><LinguiIcon name="sparkles" /></span>
        <h1>{{ instance ? '一起把它做得更好。' : '你想做一个怎样的组件？' }}</h1>
        <p>
          {{
            instance
              ? '说说想改什么，右侧可以随时预览和手动调整。'
              : '描述内容、样式和交互，AI 会帮你完成第一版。'
          }}
        </p>
        <div v-if="!instance" class="lu-chat-suggestions" aria-label="创作灵感">
          <button
            v-for="item in suggestions"
            :key="item.title"
            type="button"
            @click="choose(item.text)"
          >
            <LinguiIcon :name="item.icon" /><span>{{ item.title }}</span
            ><LinguiIcon name="arrow" />
          </button>
        </div>
      </div>
      <article
        v-for="message in messages"
        :key="message.id"
        :class="[
          'lu-chat-message',
          `is-${message.role}`,
          { 'is-error': message.status === 'error' && message.role === 'assistant' },
        ]"
      >
        <span v-if="message.role === 'assistant'" class="lu-message-author"
          ><LinguiIcon name="sparkles" />灵构 AI</span
        >
        <GenerationProgress
          v-if="message.role === 'assistant' && message.progress"
          :trace="message.progress"
          :pending="message.status === 'pending'"
        />
        <p
          v-if="message.status !== 'pending' || !message.progress || message.role !== 'assistant'"
          :class="{
            'lu-chat-working': message.status === 'pending' && message.role === 'assistant',
          }"
        >
          {{ message.text }}
        </p>
        <details v-if="message.details" class="lu-chat-error-details">
          <summary>{{ message.status === 'error' ? '查看问题详情' : '查看检查提示' }}</summary>
          <p>{{ message.details }}</p>
        </details>
        <button
          v-if="message.draft && !message.editTarget"
          type="button"
          class="lu-text-button"
          :disabled="working || blocked"
          @click="failedDraft = message"
        >
          查看待修复草稿
        </button>
        <button
          v-if="message.role === 'assistant' && message.status === 'error'"
          type="button"
          class="lu-text-button"
          :disabled="working || blocked"
          @click="submitSingle(message.instruction, { target: message.editTarget })"
        >
          重试生成
        </button>
        <div v-if="message.editProposal" class="lu-chat-proposal">
          <small
            >{{ message.editProposal.target.nodeId }} ·
            {{ message.editProposal.target.scope === 'subtree' ? '包含子组件' : '仅此组件' }}</small
          >
          <button
            v-if="message.editProposal.state === 'pending'"
            type="button"
            class="lu-button"
            :disabled="working || blocked"
            @click="reviewing = message.id"
          >
            比较并采用修改
          </button>
          <small v-else>{{
            message.editProposal.state === 'adopted'
              ? '已采用 · 可在作品中撤销'
              : '已放弃 · 当前作品已保留'
          }}</small>
        </div>
      </article>
      <slot name="candidates" />
    </div>
    <div class="lu-chat-compose">
      <EditTargetCard
        v-if="editTarget && instance"
        :instance="instance"
        :target="editTarget"
        :disabled="working"
        @update="emit('editTarget', $event)"
        @clear="emit('editTarget', undefined)"
        @reselect="emit('reselect')"
      />
      <p v-if="blocked" class="lu-muted" role="status">
        先选择采用 AI 结果，或保留当前修改，再继续对话。
      </p>
      <form class="lu-prompt-box" @submit.prevent="submit()">
        <div
          v-if="canGenerate && canGenerateMultiple"
          class="lu-generation-modes"
          role="group"
          aria-label="生成方式"
        >
          <button
            type="button"
            :aria-pressed="generationMode === 'single'"
            :disabled="working || blocked"
            @click="setGenerationMode('single')"
          >
            单方案
          </button>
          <button
            type="button"
            :aria-pressed="generationMode === 'multiple'"
            :disabled="working || blocked || !!editTarget"
            :title="editTarget ? '局部修改使用单方案' : '用同一需求生成两种布局'"
            @click="setGenerationMode('multiple')"
          >
            多方案
          </button>
          <span v-if="editTarget" class="lu-muted">局部修改</span>
          <span v-else-if="generationMode === 'multiple'" class="lu-muted"
            >生成两种布局供你比较</span
          >
        </div>
        <textarea
          ref="input"
          v-model="instruction"
          rows="2"
          maxlength="4000"
          :placeholder="
            editTarget
              ? `只调整 ${editTarget.nodeId}，例如：文字简短一点…`
              : generationMode === 'multiple'
                ? '描述同一个需求，生成两种布局进行比较…'
                : instance
                  ? '继续描述你想调整的地方…'
                  : '描述你的组件，例如：一个可以切换方案的对比表…'
          "
          aria-label="组件创作需求"
          name="instruction"
          autocomplete="off"
          @keydown="keydown"
        />
        <p
          v-if="generationMode === 'multiple' && instruction.length > 3400"
          class="lu-prompt-validation"
          role="status"
        >
          {{ sendDisabledReason }}
        </p>
        <div class="lu-ai-actions">
          <GenerationModelSelector v-if="canGenerate" :disabled="working || blocked" />
          <button
            type="button"
            class="lu-text-button lu-composer-utility"
            aria-label="连接外部 AI"
            title="连接外部 AI"
            :disabled="working || blocked"
            @click="connectingExternalAi = true"
          >
            <LinguiIcon name="code" /><span class="lu-composer-action-label">连接外部 AI</span>
          </button>
          <button
            type="button"
            class="lu-text-button lu-composer-utility"
            aria-label="导入 JSON"
            title="导入 JSON"
            :disabled="working || blocked"
            @click="emit('import')"
          >
            <LinguiIcon name="plus" /><span class="lu-composer-action-label">导入 JSON</span>
          </button>
          <button
            v-if="working"
            type="button"
            class="lu-prompt-send is-stop"
            aria-label="停止生成"
            title="停止生成"
            @click="stopAll"
          >
            <span class="lu-generation-stop-icon" aria-hidden="true" />
          </button>
          <button
            v-else-if="canGenerate"
            type="submit"
            class="lu-prompt-send"
            :disabled="!!sendDisabledReason"
            :title="sendDisabledReason || undefined"
            :aria-description="sendDisabledReason || undefined"
            :aria-label="
              generationMode === 'multiple'
                ? '生成两种方案'
                : instance
                  ? '发送修改要求'
                  : '生成组件'
            "
          >
            <span v-if="busy" class="lu-generation-status">生成中</span
            ><LinguiIcon v-else name="arrowUp" />
          </button>
        </div>
      </form>
      <p class="lu-composer-hint">
        {{
          canGenerate
            ? 'Enter 发送 · Shift + Enter 换行'
            : repository.mode === 'local'
              ? '连接 Halo 站点的 MCP 与 Skill，使用外部 AI 创作后导入 JSON。'
              : '需要管理员授权 AI 生成，也可连接外部 AI，通过 MCP 与 Skill 创作。'
        }}
      </p>
    </div>
  </section>
  <EditProposalReview
    v-if="reviewMessage?.editProposal?.state === 'pending'"
    :proposal="reviewMessage.editProposal"
    :current="instance"
    :blocked="working || blocked"
    @close="reviewing = undefined"
    @discard="finishProposal('discarded')"
    @adopt="adoptProposal"
  />
  <FailedGenerationDialog
    v-if="failedDraft?.draft"
    :draft="failedDraft.draft"
    :check="failedDraft.check"
    @close="failedDraft = undefined"
    @adopt="adoptFailedDraft"
  />
  <ExternalAiDialog
    v-if="connectingExternalAi"
    :mode="repository.mode"
    :can-use-mcp="access.allows('mcp:use')"
    :instruction="instruction"
    :instance="instance"
    :dirty="dirty"
    @close="connectingExternalAi = false"
    @import="importExternalResult"
  />
</template>
