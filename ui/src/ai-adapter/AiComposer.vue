<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { ComponentInstance, LinguiDocument, ThemeTokens } from '@lingui/renderer'
import LinguiIcon from '../shared/LinguiIcon.vue'
import { useRepository } from '../services/repository'
import { useStudioAccess } from '../services/studio-access'
import ExternalAiDialog from '../mcp/ExternalAiDialog.vue'
import { useAiConversation } from './useAiConversation'
import type { ConversationState } from './conversation'
import { cloneJson } from '../shared/clone'
import GenerationProgress from './progress/GenerationProgress.vue'
import './progress/progress.css'
import type { CheckedDesign } from '../interaction-check/types'
import FailedGenerationDialog from './FailedGenerationDialog.vue'
import type { ConversationMessage } from './conversation'
import EditTargetCard from '../scoped-edit/EditTargetCard.vue'
import EditProposalReview from '../scoped-edit/EditProposalReview.vue'
import type { EditTarget } from '../scoped-edit/model'

const props = defineProps<{
  instance?: ComponentInstance
  blocked?: boolean
  dirty?: boolean
  initialConversation?: ConversationState
  editTarget?: EditTarget
}>()
const emit = defineEmits<{
  generated: [document: LinguiDocument, source?: ComponentInstance, theme?: ThemeTokens]
  import: []
  busy: [value: boolean]
  conversation: [value: ConversationState]
  checked: [value: CheckedDesign]
  editTarget: [value: EditTarget | undefined]
  reselect: []
}>()
const repository = useRepository()
const access = useStudioAccess()
const instruction = ref(props.initialConversation?.instruction ?? '')
const connectingExternalAi = ref(false)
const failedDraft = shallowRef<ConversationMessage>()
function adoptFailedDraft() {
  const draft = failedDraft.value?.draft
  if (!draft || failedDraft.value?.editTarget || busy.value || props.blocked) return
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
  if (busy.value || props.blocked || reviewMessage.value?.editProposal?.state !== 'pending') return
  emit('generated', result.document, source)
  emit('checked', check)
  finishProposal('adopted')
}
const canGenerate = computed(() => repository.mode === 'halo' && access.allows('ai:generate'))
const sendDisabledReason = computed(() =>
  busy.value
    ? 'AI 正在生成，请完成后再发送'
    : props.blocked
      ? '请先选择保留当前修改，或采用 AI 结果'
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
  [messages, instruction],
  () =>
    emit('conversation', cloneJson({ messages: messages.value, instruction: instruction.value })),
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

async function submit(
  text = instruction.value,
  options: { target?: EditTarget } = { target: props.editTarget },
) {
  if (!canGenerate.value || busy.value || props.blocked || !text.trim()) return
  followProgress.value = true
  if (text === instruction.value) instruction.value = ''
  await send(text, options.target)
  await nextTick()
  input.value?.focus()
}
function keydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
  if (!canGenerate.value || busy.value || props.blocked) return
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
  repair: (instruction: string) => submit(instruction, {}),
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
      :class="{ 'is-empty': !messages.length }"
      role="log"
      @scroll="trackScroll"
      aria-label="创作对话记录"
      aria-live="polite"
    >
      <div v-if="!messages.length" class="lu-chat-welcome">
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
          :disabled="busy || blocked"
          @click="failedDraft = message"
        >
          查看待修复草稿
        </button>
        <button
          v-if="message.role === 'assistant' && message.status === 'error'"
          type="button"
          class="lu-text-button"
          :disabled="busy || blocked"
          @click="submit(message.instruction, { target: message.editTarget })"
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
            :disabled="busy || blocked"
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
    </div>
    <div class="lu-chat-compose">
      <EditTargetCard
        v-if="editTarget && instance"
        :instance="instance"
        :target="editTarget"
        :disabled="busy"
        @update="emit('editTarget', $event)"
        @clear="emit('editTarget', undefined)"
        @reselect="emit('reselect')"
      />
      <p v-if="blocked" class="lu-muted" role="status">
        先选择采用 AI 结果，或保留当前修改，再继续对话。
      </p>
      <form class="lu-prompt-box" @submit.prevent="submit()">
        <textarea
          ref="input"
          v-model="instruction"
          rows="3"
          maxlength="4000"
          :placeholder="
            editTarget
              ? `只调整 ${editTarget.nodeId}，例如：文字简短一点…`
              : instance
                ? '继续描述你想调整的地方…'
                : '描述你的组件，例如：一个可以切换方案的对比表…'
          "
          aria-label="组件创作需求"
          name="instruction"
          autocomplete="off"
          @keydown="keydown"
        />
        <div class="lu-ai-actions">
          <button type="button" class="lu-text-button" @click="connectingExternalAi = true">
            连接外部 AI
          </button>
          <button type="button" class="lu-text-button" @click="emit('import')">导入 JSON</button>
          <button
            v-if="busy"
            type="button"
            class="lu-prompt-send is-stop"
            aria-label="停止生成"
            title="停止生成"
            @click="stop"
          >
            <span class="lu-generation-stop-icon" aria-hidden="true" />
          </button>
          <button
            v-else-if="canGenerate"
            type="submit"
            class="lu-prompt-send"
            :disabled="busy || blocked || !instruction.trim()"
            :title="sendDisabledReason || undefined"
            :aria-description="sendDisabledReason || undefined"
            :aria-label="busy ? '正在生成' : instance ? '发送修改要求' : '生成组件'"
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
    :blocked="busy || blocked"
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
