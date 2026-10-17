import type { JsonValue } from '../protocol/types'
import type { Runtime } from '../interaction-runtime/runtime'
import type { ComponentEvent, EventAction, InteractionHost } from './types'
import { cloneEventValue, resolveEventValue, type EventValues } from './values'
import { timed } from './async'
import { requestAction } from './http'

export async function executeEventAction(
  action: EventAction,
  values: EventValues,
  runtime: Runtime,
  host: InteractionHost,
  event: ComponentEvent,
  signal: AbortSignal,
  guard: () => void,
): Promise<JsonValue> {
  const resolve = (value: JsonValue) =>
    resolveEventValue(value, { ...values, state: runtime.state })
  const observeRequest = host.trace
    ? (
        report: Pick<
          import('./types').EventReport,
          'phase' | 'http' | 'durationMs' | 'result' | 'error'
        >,
      ) => host.onEvent?.({ ...event, ...report, scope: 'request' })
    : undefined
  guard()
  let result: JsonValue = values.result
  switch (action.type) {
    case 'local':
      for (const item of action.actions) {
        guard()
        const value = item.value === undefined ? undefined : resolve(item.value)
        if (['setState', 'selectOption'].includes(item.type) && value !== undefined)
          runtime.set({ path: item.path! }, cloneEventValue(value))
        else
          runtime.dispatch({
            functionCall: { call: 'lingui.dispatch', args: { actions: [{ ...item, value }] } },
          })
      }
      break
    case 'api': {
      const api = Object.hasOwn(host.apis ?? {}, action.name) ? host.apis![action.name] : undefined
      if (!api) throw new Error(`接口「${action.name}」尚未配置，请在接口与回调中添加或映射`)
      const args = resolve(action.args ?? {})
      if (args === null || typeof args !== 'object' || Array.isArray(args))
        throw new Error('接口参数需要 JSON 对象')
      result = await requestAction(
        {
          type: 'request',
          url: api.url,
          method: api.method,
          ...(api.method === 'GET'
            ? { query: (action.args ?? {}) as Record<string, JsonValue> }
            : { body: action.args ?? {} }),
          timeoutMs: action.timeoutMs,
        },
        { ...values, state: runtime.state },
        host,
        signal,
        observeRequest,
      )
      break
    }
    case 'request':
      result = await requestAction(
        action,
        { ...values, state: runtime.state },
        host,
        signal,
        observeRequest,
      )
      break
    case 'callback': {
      const handler = Object.hasOwn(host.callbacks ?? {}, action.name)
        ? host.callbacks![action.name]
        : undefined
      if (!handler) throw new Error(`JS 回调「${action.name}」尚未在宿主中注册`)
      result = cloneEventValue(
        await timed(
          async (callbackSignal) =>
            handler(resolve(action.args ?? null), {
              ...event,
              signal: callbackSignal,
              getState: () => cloneEventValue(runtime.state) as typeof runtime.state,
              setState: (path, value) => {
                guard()
                if (callbackSignal.aborted) throw callbackSignal.reason
                runtime.set({ path }, cloneEventValue(value))
              },
            }),
          signal,
          action.timeoutMs ?? 15000,
        ),
      )
      break
    }
    case 'delay':
      await timed(
        (delaySignal) =>
          new Promise<void>((resolve, reject) => {
            const abort = () => {
              clearTimeout(timer)
              reject(delaySignal.reason)
            }
            const timer = setTimeout(() => {
              delaySignal.removeEventListener('abort', abort)
              resolve()
            }, action.ms)
            delaySignal.addEventListener('abort', abort, { once: true })
          }),
        signal,
        action.ms + 1000,
      )
      break
    case 'emit':
      host.onEvent?.({
        ...event,
        phase: 'emit',
        name: action.name,
        result: resolve(action.detail ?? null),
      })
      break
  }
  guard()
  if ('resultPath' in action && action.resultPath) runtime.set({ path: action.resultPath }, result)
  return result
}
