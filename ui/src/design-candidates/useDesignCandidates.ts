import { onBeforeUnmount, ref, shallowRef } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import type { StudioRepository } from '../component-library/types'
import { CheckedGenerationError, generateCheckedDesign } from '../ai-adapter/checked-generation'
import { generationError } from '../ai-adapter/generation-error'
import { updateTrace, finishTrace, type GenerationTrace } from '../ai-adapter/progress/types'
import { sanitizeDiagnostic } from '../component-studio/debug-records'
import { candidateInstance, type CandidateSet, type DesignCandidate } from './model'
import { cloneJson } from '../shared/clone'
export function useDesignCandidates(options: {
  generate: StudioRepository['generate']
  current: () => ComponentInstance | undefined
  initial?: CandidateSet
  changed: (value: CandidateSet) => void
  busy: (value: boolean) => void
}) {
  const set = shallowRef<CandidateSet | undefined>(
      options.initial ? cloneJson(options.initial) : undefined,
    ),
    busy = ref(false)
  const controllers = new Map<string, AbortController>()
  let disposed = false
  const publish = () => {
    if (!disposed && set.value) options.changed(cloneJson(set.value))
  }
  function update(id: string, patch: Partial<DesignCandidate>) {
    if (disposed || !set.value) return
    set.value = {
      ...set.value,
      candidates: set.value.candidates.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }
    publish()
  }
  const item = (direction: string): DesignCandidate => ({
    id: `candidate-${crypto.randomUUID()}`,
    direction,
    status: 'queued',
  })
  async function run(candidate: DesignCandidate) {
    const batch = set.value!,
      controller = new AbortController()
    controllers.set(candidate.id, controller)
    let trace: GenerationTrace = { activities: [], elapsedMs: 0, outcome: 'running' }
    update(candidate.id, { status: 'running', error: '', trace })
    let attempt = 0
    const started = Date.now()
    const progress = (event: Parameters<typeof updateTrace>[1]) => {
      trace = updateTrace(trace, {
        ...event,
        ...(event.id ? { id: `round-${attempt}-${event.id}` } : {}),
        elapsedMs: Date.now() - started,
      })
      update(candidate.id, { trace })
    }
    try {
      const result = await generateCheckedDesign({
        prompt: `${batch.prompt}\n本案设计方向：${candidate.direction}。保留需求、接口配置和现有主题，不删减交互功能。`,
        context: batch.source?.document,
        source: batch.source,
        generate: options.generate,
        signal: controller.signal,
        progress,
        attempt: (round) => {
          attempt = round
        },
        activity: (id, label, state = 'running') =>
          progress({ type: 'activity', id, label, state }),
      })
      if (controller.signal.aborted || disposed) return
      update(candidate.id, {
        status: 'done',
        instance: candidateInstance(result.design, batch.source),
        check: result.report,
        trace: finishTrace(trace, 'done'),
      })
    } catch (cause) {
      const problem = generationError(
        cause instanceof CheckedGenerationError ? cause.problem : cause,
      )
      update(candidate.id, {
        status: controller.signal.aborted ? 'stopped' : 'error',
        error: controller.signal.aborted
          ? '已取消；其他方案保留'
          : String(sanitizeDiagnostic(problem.text)),
        trace: finishTrace(trace, controller.signal.aborted ? 'stopped' : 'error'),
      })
    } finally {
      controllers.delete(candidate.id)
    }
  }
  async function queue(candidates: DesignCandidate[]) {
    if (busy.value) return
    busy.value = true
    options.busy(true)
    try {
      for (const candidate of candidates) {
        if (
          disposed ||
          set.value?.candidates.find((row) => row.id === candidate.id)?.status === 'stopped'
        )
          continue
        await run(candidate)
      }
    } finally {
      busy.value = false
      if (!disposed) options.busy(false)
    }
  }
  function start(prompt: string) {
    if (busy.value || !prompt.trim() || prompt.length > 3400) return
    set.value = {
      id: `candidates-${crypto.randomUUID()}`,
      prompt: prompt.trim(),
      source: options.current() ? cloneJson(options.current()!) : undefined,
      candidates: [
        item('紧凑信息卡：强调效率、清晰分组与紧密布局'),
        item('舒展展示卡：强调阅读节奏、留白和视觉层次'),
      ],
    }
    publish()
    return queue(set.value.candidates)
  }
  function cancel(id: string) {
    controllers.get(id)?.abort()
    update(id, { status: 'stopped', error: '已取消，可单独重试' })
  }
  function stop() {
    const pending =
      set.value?.candidates.filter((row) => ['queued', 'running'].includes(row.status)) ?? []
    for (const row of pending) cancel(row.id)
  }
  function retry(id: string) {
    const row = set.value?.candidates.find((row) => row.id === id)
    if (row && !busy.value && ['error', 'stopped'].includes(row.status)) {
      update(id, { status: 'queued', error: '' })
      return queue([row])
    }
  }
  function third() {
    if (!set.value || busy.value || set.value.candidates.length >= 3) return
    const row = item('第三案：以分步交互为主，降低首屏信息密度')
    set.value = { ...set.value, candidates: [...set.value.candidates, row] }
    publish()
    return queue([row])
  }
  function addCombined(instance: ComponentInstance) {
    if (!set.value || busy.value) return
    const row = { ...item('显式组合：方案一布局 + 方案二配色'), status: 'done' as const, instance }
    set.value = {
      ...set.value,
      candidates: [
        ...set.value.candidates.filter((item) => !item.direction.startsWith('显式组合')),
        row,
      ],
    }
    publish()
  }
  onBeforeUnmount(() => {
    disposed = true
    controllers.forEach((controller) => controller.abort())
    controllers.clear()
  })
  return { set, busy, start, stop, cancel, retry, third, addCombined }
}
