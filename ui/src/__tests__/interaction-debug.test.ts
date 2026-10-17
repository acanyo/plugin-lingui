import { describe, expect, it } from 'vitest'
import {
  createEventRuntime,
  createRuntime,
  type EventReport,
  type ComponentNode,
} from '@lingui/renderer'
import { sanitizeDebugReport, groupDebugReports } from '../component-studio/debug-records'
function button(): ComponentNode {
  return {
    id: 'refresh',
    component: 'Button',
    child: 'label',
    events: {
      click: {
        actions: [
          { type: 'request', url: 'https://example.com/data', resultPath: '/response' },
          { type: 'callback', name: 'finish', args: { $result: '/' } },
        ],
        loadingPath: '/loading',
        errorPath: '/error',
        resultPath: '/result',
      },
    },
  }
}
describe('interaction diagnostics', () => {
  it('reports built-in state interactions even when no custom event binding is declared', async () => {
    const reports: EventReport[] = [],
      state = createRuntime({ answer: [] })
    const events = createEventRuntime(state, {
      trace: true,
      onEvent: (report) => reports.push(report),
    })
    state.set({ path: '/answer' }, ['heap'])
    await events.fire(
      { id: 'answer', component: 'ChoicePicker', value: { path: '/answer' }, options: [] },
      'change',
      { value: ['heap'], previousValue: [] },
    )
    expect(reports).toHaveLength(1)
    expect(reports[0]?.stateChanges).toContainEqual({
      path: '/answer',
      before: [],
      after: ['heap'],
    })
    events.destroy()
  })
  it('groups HTTP, callback and final state changes under the same interaction', async () => {
    const reports: EventReport[] = [],
      runtime = createRuntime({ response: null, loading: false, error: '', result: null })
    const events = createEventRuntime(runtime, {
      trace: true,
      onEvent: (report) => reports.push(report),
      requests: {
        allow: () => true,
        fetch: async () => new Response('{"count":12}', { status: 200 }),
      },
      callbacks: { finish: (args) => args },
    })
    await events.fire(button(), 'click')
    const request = reports.find(
      (report) => report.scope === 'request' && report.phase === 'success',
    )!
    expect(request.http).toMatchObject({ method: 'GET', status: 200 })
    expect(
      reports.some((report) => report.actionType === 'callback' && report.phase === 'success'),
    ).toBe(true)
    expect(reports.at(-1)?.stateChanges).toContainEqual({
      path: '/response',
      before: null,
      after: { count: 12 },
    })
    expect(reports.at(-1)?.durationMs).toBeGreaterThanOrEqual(0)
    expect(new Set(reports.map((report) => report.runId)).size).toBe(1)
    const groups = groupDebugReports(
      reports.map((report, id) => ({ ...report, id, time: '12:00' })),
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.status).toBe('success')
    expect(groups[0]?.steps.every((report) => report.phase !== 'start')).toBe(true)
    events.destroy()
  })
  it('keeps HTTP status and callback errors inspectable with error recovery steps', async () => {
    const reports: EventReport[] = [],
      state = createRuntime({ response: null, loading: false, error: '' })
    const events = createEventRuntime(state, {
      trace: true,
      onEvent: (report) => reports.push(report),
      requests: {
        allow: () => true,
        fetch: async () => new Response('{"message":"维护中"}', { status: 503 }),
      },
    })
    await events.fire(button(), 'click')
    expect(
      reports.find((report) => report.scope === 'request' && report.phase === 'error')?.http
        ?.status,
    ).toBe(503)
    expect(reports.at(-1)?.error).toContain('维护中')
    const callback = button()
    callback.events!.click!.actions = [{ type: 'callback', name: 'missing' }]
    await events.fire(callback, 'click')
    expect(
      reports.find((report) => report.actionType === 'callback' && report.phase === 'error')?.error,
    ).toContain('尚未在宿主中注册')
    events.destroy()
  })
  it('redacts credential fields and query values before display or export while retaining useful results', () => {
    const value = sanitizeDebugReport({
      nodeId: 'load',
      component: 'Button',
      event: 'click',
      data: { password: 'private', value: 'safe' },
      phase: 'success',
      result: { access_token: 'private-token', count: 12 },
      http: { method: 'GET', url: 'https://example.com/?api_key=private-key&q=weather' },
      stateChanges: [{ path: '/secret/key', before: 'before-private', after: 'after-private' }],
    })
    const serialized = JSON.stringify(value)
    expect(serialized).not.toContain('private')
    expect(serialized).toContain('weather')
    expect(serialized).toContain('count')
    const password = sanitizeDebugReport({
      nodeId: 'field-one',
      component: 'LingUI.PasswordInput',
      event: 'change',
      phase: 'success',
      data: { value: 'private-input' },
      stateChanges: [{ path: '/field1', before: '', after: 'private-input' }],
    })
    expect(JSON.stringify(password)).not.toContain('private-input')
  })
})
