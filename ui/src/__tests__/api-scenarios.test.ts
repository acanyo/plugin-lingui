import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createRuntime, createEventRuntime } from '@lingui/renderer'
import { document, text } from '../../../packages/renderer/src/examples/builders'
import {
  apiTargets,
  defaultScenario,
  endpointKey,
  validateScenario,
} from '../integrations/scenarios/model'
import { createScenarioRequests } from '../integrations/scenarios/transport'
import { useApiScenarios } from '../integrations/scenarios/useApiScenarios'
afterEach(() => vi.useRealTimers())
const target = {
  key: endpointKey('https://example.com/data'),
  label: '数据',
  url: 'https://example.com/data',
  method: 'GET',
  example: { items: [{ id: 'one' }], total: 1 },
}
function fixture() {
  const fallback = vi.fn(async () => new Response('{"real":true}'))
  const rule = defaultScenario(target)
  return {
    rule,
    fallback,
    requests: (mode: typeof rule.mode) =>
      createScenarioRequests(
        { allow: () => true, fetch: fallback },
        { [target.key]: { ...rule, mode } },
      ),
  }
}
describe('API preview scenarios', () => {
  it('intercepts success and empty data while isolating method, domain and path', async () => {
    const { requests, fallback } = fixture()
    expect(
      await (await requests('success').fetch!('https://example.com/data?q=one')).json(),
    ).toEqual(target.example)
    expect(await (await requests('empty').fetch!('https://example.com/data')).json()).toEqual({
      items: [],
      total: 0,
    })
    await requests('success').fetch!('https://example.com/data', { method: 'POST' })
    await requests('success').fetch!('https://other.example/data')
    await requests('real').fetch!('https://example.com/data')
    expect(fallback).toHaveBeenCalledTimes(3)
  })
  it('returns configured HTTP failures without calling a real endpoint', async () => {
    const { rule, fallback } = fixture()
    const requests = createScenarioRequests(
      { allow: () => false, fetch: fallback },
      { [target.key]: { ...rule, mode: 'failure', status: 429, message: '请求频率过高' } },
    )
    expect(requests.allow(new URL(target.url), 'GET')).toBe(true)
    const response = await requests.fetch!(target.url)
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ message: '请求频率过高' })
    expect(fallback).not.toHaveBeenCalled()
  })
  it('keeps slow requests cancellable and releases loading on a real action timeout', async () => {
    vi.useFakeTimers()
    const { rule, fallback } = fixture()
    const requests = createScenarioRequests(
      { allow: () => true, fetch: fallback },
      { [target.key]: { ...rule, mode: 'slow', delayMs: 2000 } },
    )
    const state = createRuntime({ loading: false, error: '', result: null })
    const events = createEventRuntime(state, { requests })
    const running = events.fire(
      {
        id: 'load',
        component: 'Button',
        child: 'label',
        events: {
          click: {
            loadingPath: '/loading',
            errorPath: '/error',
            actions: [{ type: 'request', url: target.url, timeoutMs: 100 }],
          },
        },
      },
      'click',
    )
    expect(state.state.loading).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await running
    expect(state.state.loading).toBe(false)
    expect(state.state.error).toContain('超时')
    expect(vi.getTimerCount()).toBe(0)
    expect(fallback).not.toHaveBeenCalled()
    events.destroy()
    const controller = new AbortController()
    const pending = requests.fetch!(target.url, { signal: controller.signal })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })
  it('finds named and direct requests in all event branches without changing the work', () => {
    const work = document('场景', [
      {
        id: 'root',
        component: 'Button',
        child: 'label',
        events: {
          click: {
            actions: [{ type: 'api', name: 'data' }],
            onError: [{ type: 'request', url: '/fallback', method: 'POST' }],
          },
        },
      },
      text('label', '加载'),
    ])
    work.integrations = {
      apis: [
        {
          name: 'data',
          label: '数据',
          url: target.url,
          method: 'GET',
          responseExample: target.example,
        },
      ],
      callbacks: [],
    }
    const before = JSON.stringify(work),
      scope = effectScope()
    const controller = scope.run(() => useApiScenarios(() => work))!
    expect(controller.targets.value).toHaveLength(2)
    controller.apply(target.key, {
      ...defaultScenario(controller.targets.value[0]!),
      mode: 'empty',
    })
    expect(controller.active.value).toBe(1)
    controller.reset()
    expect(controller.active.value).toBe(0)
    expect(apiTargets(work)[0]!.example).toEqual(target.example)
    expect(JSON.stringify(work)).toBe(before)
    scope.stop()
  })
  it('validates unsafe or oversized fixture data and preserves literal null responses', () => {
    expect(() => validateScenario({ ...defaultScenario(target), status: 200 })).toThrow('400')
    expect(() => validateScenario({ ...defaultScenario(target), delayMs: 60001 })).toThrow('60000')
    expect(() =>
      validateScenario({ ...defaultScenario(target), success: JSON.parse('{"__proto__":{}}') }),
    ).toThrow('不安全')
    expect(defaultScenario({ ...target, example: null }).success).toBeNull()
  })
})
