import type { InteractionHost } from '@lingui/renderer'
import { endpointKey, type ApiScenario } from './model'
type Requests = NonNullable<InteractionHost['requests']>
export function scenarioWait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(signal?.reason ?? new DOMException('已取消', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}
/** Snapshot the rules so a running request cannot change scenario halfway through. */
export function createScenarioRequests(
  base: Requests,
  rules: Record<string, ApiScenario>,
): Requests {
  const scenario = (url: string, method: string) => {
    const value = rules[endpointKey(url, method)]
    return value?.mode !== 'real' ? value : undefined
  }
  return {
    allow: (url, method) => !!scenario(url.toString(), method) || base.allow(url, method),
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : undefined
      const value = scenario(
        request?.url ?? String(input),
        init?.method ?? request?.method ?? 'GET',
      )
      if (!value) return (base.fetch ?? globalThis.fetch)(input, init)
      const signal = init?.signal ?? request?.signal
      if (signal?.aborted) throw signal.reason
      if (value.mode === 'slow' && value.delayMs) await scenarioWait(value.delayMs, signal)
      return new Response(
        JSON.stringify(
          value.mode === 'failure'
            ? { message: value.message }
            : value.mode === 'empty'
              ? value.empty
              : value.success,
        ),
        {
          status: value.mode === 'failure' ? value.status : 200,
          headers: { 'Content-Type': 'application/json', 'X-Lingui-Scenario': value.mode },
        },
      )
    },
  }
}
