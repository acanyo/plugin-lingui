import { onScopeDispose, ref, shallowRef } from 'vue'
import {
  validateDocument,
  createInstance,
  type ComponentInstance,
  type LinguiDocument,
  type ThemeTokens,
} from '@lingui/renderer'
import { checkContracts } from './contract-check'
import { generateCheckedDesign, CheckedGenerationError } from './checked-generation'
import type { StudioRepository } from '../component-library/types'
import { cloneJson } from '../shared/clone'
import { generationError } from './generation-error'
import { conversationInstruction, type ConversationMessage } from './conversation'
import type { GenerationEvent } from '../api/generated'
import { finishTrace, updateTrace, type GenerationTrace } from './progress/types'
import { checkFingerprint } from '../interaction-check/run'
import type { CheckedDesign } from '../interaction-check/types'
import { checkSummary } from '../interaction-check/repair'
import { updateInstanceDocument } from '../component-studio/document-editor'
import { assertEditScope, scopedInstruction, type EditTarget } from '../scoped-edit/model'

export function useAiConversation(
  repository: StudioRepository,
  current: () => ComponentInstance | undefined,
  generated: (document: LinguiDocument, source?: ComponentInstance, theme?: ThemeTokens) => void,
  initialMessages: ConversationMessage[] = [],
  checked: (value: CheckedDesign) => void = () => {},
) {
  const messages = shallowRef<ConversationMessage[]>(cloneJson(initialMessages))
  const busy = ref(false)
  let id = Math.max(0, ...initialMessages.map((message) => message.id))
  let disposed = false
  let controller: AbortController | undefined
  onScopeDispose(() => {
    disposed = true
    controller?.abort()
  })
  function stop() {
    controller?.abort()
  }

  async function send(instruction: string, target?: EditTarget) {
    const text = instruction.trim()
    if (busy.value || !text || text.length > 4000 || disposed) return
    const value = current()
    const source = value ? cloneJson(value) : undefined
    if (target && !source) return
    const prompt = conversationInstruction(messages.value, text)
    const user: ConversationMessage = { id: ++id, role: 'user', text, status: 'pending' }
    const assistant: ConversationMessage = {
      id: ++id,
      role: 'assistant',
      text: source ? '正在调整组件…' : '正在生成组件…',
      status: 'pending',
      instruction: text,
      ...(target ? { editTarget: cloneJson(target) } : {}),
      progress: { activities: [], elapsedMs: 0, outcome: 'running' },
    }
    messages.value = [...messages.value, user, assistant]
    busy.value = true
    controller = new AbortController()
    const signal = controller.signal
    const started = performance.now()
    let attempt = 0
    let trace: GenerationTrace = { activities: [], elapsedMs: 0, outcome: 'running' }
    function progress(event: GenerationEvent) {
      if (disposed || signal.aborted) return
      trace = updateTrace(trace, {
        ...event,
        ...(event.id ? { id: `attempt-${attempt}-${event.id}` } : {}),
        elapsedMs: Math.max(trace.elapsedMs, performance.now() - started),
      })
      messages.value = messages.value.map((message) =>
        message.id === assistant.id ? { ...message, progress: trace } : message,
      )
    }
    function activity(
      id: string,
      label: string,
      state: 'running' | 'done' | 'warning' = 'running',
    ) {
      progress({ type: 'activity', id, label, state, elapsedMs: 0 })
    }
    function finish(outcome: GenerationTrace['outcome']) {
      trace = finishTrace({ ...trace, elapsedMs: performance.now() - started }, outcome)
      return trace
    }
    try {
      const context = target
        ? source?.document
        : source
          ? validateDocument({
              ...source.document,
              parameters: source.document.parameters.map((parameter) => ({
                ...parameter,
                default: source.parameters[parameter.key] ?? parameter.default,
              })),
            })
          : undefined
      const {
        design,
        report: interactionCheck,
        repairs,
      } = await generateCheckedDesign({
        prompt: target && source ? scopedInstruction(text, source, target) : prompt,
        context,
        source,
        compareChecksToSource: !!target,
        signal,
        generate: repository.generate.bind(repository),
        progress,
        attempt: (round) => {
          attempt = round
        },
        activity,
        ...(target && source
          ? {
              validateCandidate: (design: import('./design-result').GeneratedDesign) =>
                assertEditScope(source, design, target),
            }
          : {}),
      })
      const { document, theme } = design
      const warnings = checkContracts(document).filter((issue) => issue.level === 'warning')
      if (disposed) return
      if (signal.aborted) throw new DOMException('已停止生成', 'AbortError')
      if (!target) generated(document, source, theme)
      const checkedInstance = source
        ? updateInstanceDocument(source, document)
        : createInstance(document)
      if (!target)
        checked({ report: interactionCheck, fingerprint: checkFingerprint(checkedInstance) })
      messages.value = messages.value.map((message) =>
        message.id === user.id
          ? { ...message, status: 'done' }
          : message.id === assistant.id
            ? {
                ...message,
                status: 'done',
                progress: finish('done'),
                ...(target && source
                  ? {
                      editProposal: {
                        target: cloneJson(target),
                        source,
                        design,
                        state: 'pending' as const,
                      },
                    }
                  : {}),
                text: `${target ? `已完成 ${target.nodeId} 的局部修改，请先比较差异再采用。当前作品尚未改变。${interactionCheck.cases.some((row) => row.status === 'failed') ? '原作品已有交互问题，本次未新增，请查看检查提示。' : ''}` : `已生成「${document.title}」。在右侧试用，也可以继续告诉我需要调整的地方。`}${repairs ? `已自动修正 ${repairs} 轮。` : ''}${warnings.length ? `有 ${warnings.length} 处数据路径需要运行确认。` : ''}`,
                details: `${checkSummary(interactionCheck)}${interactionCheck.issues.length ? `\n${interactionCheck.issues.map((issue) => `${issue.nodeId}：${issue.message}`).join('\n')}` : ''}${
                  warnings.length
                    ? `\n${warnings.map((issue) => `${issue.nodeId}：${issue.message}`).join('\n')}`
                    : ''
                }`,
              }
            : message,
      )
    } catch (cause) {
      if (disposed) return
      const stopped = signal.aborted
      const problem = stopped
        ? {
            text: '已停止生成，当前作品已保留。可以修改需求后重新发送。',
            details: '本次请求已取消，不会应用尚未完成的结果。',
          }
        : generationError(cause instanceof CheckedGenerationError ? cause.problem : cause)
      messages.value = messages.value.map((message) =>
        message.id === user.id
          ? { ...message, status: 'error' }
          : message.id === assistant.id
            ? {
                ...message,
                status: 'error',
                text: problem.text,
                details: problem.details,
                progress: finish(stopped ? 'stopped' : 'error'),
                ...(!target && !stopped && cause instanceof CheckedGenerationError && cause.draft
                  ? { draft: cause.draft, check: cause.report }
                  : {}),
              }
            : message,
      )
    } finally {
      if (!disposed) busy.value = false
    }
  }
  return { messages, busy, send, stop }
}
