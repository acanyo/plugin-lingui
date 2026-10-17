import type { ComponentNode, JsonValue } from '../protocol/types'
import type { Runtime } from '../interaction-runtime/runtime'
import type { ComponentEventName, EventBinding, EventReport, InteractionHost } from './types'
import { supportedEvents } from './capabilities'
import { cloneEventValue, type EventValues } from './values'
import { executeEventAction } from './actions'
import { stateChanges } from './state-changes'

export function createEventRuntime(
  runtime: Runtime,
  host: InteractionHost = {},
  reportError: (cause: unknown) => void = () => {},
) {
  const jobs = new Map<string, AbortController>(),
    pending = new Map<string, ReturnType<typeof setTimeout>>()
  const subscribers = new Set<(ids: Set<string>) => void>()
  const loading = new Map<string, Set<AbortController>>()
  let disposed = false
  let serial = 0
  const traceId = crypto.randomUUID()
  let lastObservedState = runtime.state
  const notifyBusy = () => {
    const ids = new Set([...jobs.keys()].map((key) => key.split(':')[0]!))
    subscribers.forEach((fn) => fn(ids))
  }
  const report = (value: EventReport) => {
    try {
      // Diagnostics may include both a response and state diff, exceeding the document envelope.
      // Their values were validated at the event/action boundary; copy without reapplying that limit.
      host.onEvent?.(JSON.parse(JSON.stringify(value)) as EventReport)
    } catch (cause) {
      reportError(cause)
    }
  }
  async function run(
    node: ComponentNode,
    event: ComponentEventName,
    data: JsonValue,
    binding: EventBinding,
    key: string,
  ) {
    if (disposed) return
    if (jobs.has(key) && (binding.concurrency ?? 'drop') === 'drop') return
    jobs.get(key)?.abort(new DOMException('新事件替换了旧请求', 'AbortError'))
    const controller = new AbortController()
    jobs.set(key, controller)
    notifyBusy()
    const details = {
      runId: `${traceId}-${++serial}`,
      nodeId: node.id,
      component: node.component,
      event,
      data: cloneEventValue(data),
    }
    const started = performance.now()
    const initial = host.trace ? lastObservedState : runtime.state
    lastObservedState = runtime.state
    const guard = () => {
      if (disposed || controller.signal.aborted || jobs.get(key) !== controller)
        throw controller.signal.reason ?? new DOMException('操作已取消', 'AbortError')
    }
    const values: EventValues = {
      state: runtime.state,
      event: details.data,
      result: null,
      error: null,
    }
    const steps = async (
      actions: EventBinding['actions'],
      branch: 'actions' | 'onSuccess' | 'onError',
    ) => {
      for (const [index, action] of actions.entries()) {
        const before = runtime.state,
          actionStarted = performance.now()
        const actionDetails = {
          ...details,
          scope: 'action' as const,
          actionType: action.type,
          branch,
          step: index + 1,
          ...('name' in action ? { name: action.name } : {}),
        }
        if (host.trace) report({ ...actionDetails, phase: 'start' })
        try {
          values.result = await executeEventAction(
            action,
            values,
            runtime,
            {
              ...host,
              onEvent: (value) =>
                report({ ...value, runId: details.runId, branch, step: index + 1 }),
            },
            details,
            controller.signal,
            guard,
          )
          if (host.trace)
            report({
              ...actionDetails,
              phase: 'success',
              durationMs: Math.round(performance.now() - actionStarted),
              result: values.result,
              stateChanges: stateChanges(before, runtime.state),
            })
        } catch (cause) {
          if (host.trace)
            report({
              ...actionDetails,
              phase: controller.signal.aborted ? 'cancelled' : 'error',
              durationMs: Math.round(performance.now() - actionStarted),
              error: cause instanceof Error ? cause.message : '动作执行失败',
              stateChanges: stateChanges(before, runtime.state),
            })
          throw cause
        }
      }
    }
    let terminal: EventReport | undefined
    try {
      if (binding.loadingPath) {
        const active = loading.get(binding.loadingPath) ?? new Set<AbortController>()
        active.add(controller)
        loading.set(binding.loadingPath, active)
        runtime.set({ path: binding.loadingPath }, true)
      }
      if (binding.errorPath) runtime.set({ path: binding.errorPath }, '')
      report({ ...details, phase: 'start' })
      await steps(binding.actions, 'actions')
      guard()
      if (binding.resultPath) runtime.set({ path: binding.resultPath }, values.result)
      await steps(binding.onSuccess ?? [], 'onSuccess')
      guard()
      terminal = { ...details, phase: 'success', result: values.result }
    } catch (cause) {
      if (controller.signal.aborted || disposed || jobs.get(key) !== controller) {
        terminal = { ...details, phase: 'cancelled' }
      } else {
        const message = cause instanceof Error ? cause.message : '事件执行失败'
        values.error = { message }
        values.result = null
        try {
          if (binding.errorPath) runtime.set({ path: binding.errorPath }, message)
          await steps(binding.onError ?? [], 'onError')
        } catch (branchError) {
          reportError(branchError)
        }
        terminal = { ...details, phase: 'error', error: message }
        reportError(cause)
      }
    } finally {
      if (binding.loadingPath) {
        const active = loading.get(binding.loadingPath)
        active?.delete(controller)
        if (active && !active.size) {
          loading.delete(binding.loadingPath)
          if (!disposed) {
            try {
              runtime.set({ path: binding.loadingPath }, false)
            } catch (cause) {
              reportError(cause)
            }
          }
        }
      }
      if (jobs.get(key) === controller) {
        jobs.delete(key)
        notifyBusy()
      }
      if (terminal)
        report({
          ...terminal,
          ...(host.trace
            ? {
                durationMs: Math.round(performance.now() - started),
                stateChanges: stateChanges(initial, runtime.state),
              }
            : {}),
        })
      lastObservedState = runtime.state
    }
  }
  return {
    fire(node: ComponentNode, event: ComponentEventName, data: JsonValue = null): Promise<void> {
      if (disposed || !supportedEvents(node.component).includes(event)) return Promise.resolve()
      const binding = node.events?.[event]
      try {
        data = cloneEventValue(data)
      } catch (cause) {
        reportError(cause)
        report({
          nodeId: node.id,
          component: node.component,
          event,
          data: null,
          phase: 'error',
          error: cause instanceof Error ? cause.message : '事件数据无效',
        })
        return Promise.resolve()
      }
      if (!binding) {
        if (host.trace && !['focus', 'blur', 'load', 'timeUpdate'].includes(event)) {
          report({
            nodeId: node.id,
            component: node.component,
            event,
            data,
            runId: `${traceId}-${++serial}`,
            scope: 'event',
            phase: 'success',
            name: '组件内置交互',
            durationMs: 0,
            stateChanges: stateChanges(lastObservedState, runtime.state),
          })
          lastObservedState = runtime.state
        }
        return Promise.resolve()
      }
      const key = `${node.id}:${event}`
      clearTimeout(pending.get(key))
      pending.delete(key)
      if ((binding.debounceMs ?? 0) > 0) {
        if (binding.concurrency === 'latest')
          jobs.get(key)?.abort(new DOMException('输入已更新', 'AbortError'))
        pending.set(
          key,
          setTimeout(() => {
            pending.delete(key)
            void run(node, event, data, binding, key)
          }, binding.debounceMs),
        )
        return Promise.resolve()
      }
      return run(node, event, data, binding, key)
    },
    subscribe(fn: (ids: Set<string>) => void) {
      subscribers.add(fn)
      fn(new Set())
      return () => subscribers.delete(fn)
    },
    destroy() {
      disposed = true
      pending.forEach(clearTimeout)
      pending.clear()
      jobs.forEach((job) => job.abort())
      jobs.clear()
      loading.clear()
      subscribers.clear()
    },
  }
}
export type EventRuntime = ReturnType<typeof createEventRuntime>
