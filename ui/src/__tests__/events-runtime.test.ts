import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRuntime,
  createEventRuntime,
  serializeSource,
  validateDocument,
  componentNames,
  supportedEvents,
  type ComponentNode,
  type EventBinding,
  type EventReport,
} from '@lingui/renderer'

const runtimes: ReturnType<typeof createEventRuntime>[] = []
afterEach(() => {
  runtimes.splice(0).forEach((runtime) => runtime.destroy())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function setup(binding: EventBinding, host = {} as Parameters<typeof createEventRuntime>[1]) {
  const state = createRuntime({
      count: 1,
      query: '灵构',
      loading: false,
      error: '',
      response: null,
    }),
    reports: EventReport[] = [],
    errors: unknown[] = []
  const events = createEventRuntime(
    state,
    { ...host, onEvent: (report) => reports.push(report) },
    (error) => errors.push(error),
  )
  runtimes.push(events)
  const node: ComponentNode = {
    id: 'save',
    component: 'Button',
    child: 'label',
    events: { click: binding },
  }
  return { state, events, node, reports, errors }
}
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve()
}
describe('component event execution', () => {
  it('calls an async JS callback, writes its result, and resolves success parameters', async () => {
    const callback = vi.fn(async (args, context) => {
      context.setState('/count', 3)
      return { value: args.value, saved: true }
    })
    const { state, events, node, reports } = setup(
      {
        actions: [{ type: 'callback', name: 'save', args: { value: { $event: '/value' } } }],
        loadingPath: '/loading',
        errorPath: '/error',
        resultPath: '/response',
        onSuccess: [
          {
            type: 'local',
            actions: [{ type: 'setState', path: '/summary', value: { $result: '/' } }],
          },
        ],
      },
      { callbacks: { save: callback } },
    )
    await events.fire(node, 'click', { value: '你好' })
    expect(state.state).toMatchObject({
      count: 3,
      loading: false,
      error: '',
      response: { value: '你好', saved: true },
      summary: { value: '你好', saved: true },
    })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(reports.map((report) => report.phase)).toEqual(['start', 'success'])
  })
  it('sends resolved query/body/headers to an API and can chain callback results', async () => {
    const request = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 7 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const callback = vi.fn(async (args) => ({ ...args, ready: true }))
    const { state, events, node } = setup(
      {
        actions: [
          {
            type: 'request',
            url: 'https://api.example.com/save',
            method: 'POST',
            query: { q: { $state: '/query' }, tags: ['one', 'two'] },
            headers: { 'X-Source': 'lingui' },
            body: { value: { $event: '/value' } },
            resultPath: '/raw',
          },
          { type: 'callback', name: 'finish', args: { $result: '/' } },
        ],
        resultPath: '/response',
      },
      {
        requests: { allow: (url) => url.origin === 'https://api.example.com', fetch: request },
        callbacks: { finish: callback },
      },
    )
    await events.fire(node, 'click', { value: 42 })
    const [url, config] = request.mock.calls[0]! as unknown as [string, RequestInit]
    expect(new URL(url).searchParams.get('q')).toBe('灵构')
    expect(new URL(url).searchParams.getAll('tags')).toEqual(['one', 'two'])
    expect(config).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      body: '{"value":42}',
    })
    expect((config.headers as Headers).get('X-Source')).toBe('lingui')
    expect(state.state).toMatchObject({ raw: { id: 7 }, response: { id: 7, ready: true } })
  })
  it('calls APIs with browser fetch by default without requiring a host adapter', async () => {
    const fetch = vi.fn(async () => new Response('{"temperature":22}'))
    vi.stubGlobal('fetch', fetch)
    const value = setup({
      actions: [{ type: 'request', url: 'https://api.example.com/weather' }],
      loadingPath: '/loading',
      errorPath: '/error',
      resultPath: '/response',
    })
    await value.events.fire(value.node, 'click')
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'https://api.example.com/weather',
      expect.objectContaining({ method: 'GET', credentials: 'omit', redirect: 'error' }),
    )
    expect(value.state.state).toMatchObject({
      response: { temperature: 22 },
      loading: false,
      error: '',
    })
    expect(value.reports.at(-1)?.phase).toBe('success')
  })
  it('respects an explicit embedding host policy and returns useful HTTP error details', async () => {
    const fetch = vi.fn(
      async () => new Response('{"detail":"参数 name 不能为空"}', { status: 422 }),
    )
    const value = setup(
      {
        actions: [{ type: 'request', url: 'https://api.example.com/save' }],
        errorPath: '/error',
        onError: [
          {
            type: 'local',
            actions: [{ type: 'setState', path: '/notice', value: { $error: '/message' } }],
          },
        ],
      },
      { requests: { allow: () => false, fetch } },
    )
    await value.events.fire(value.node, 'click')
    expect(fetch).not.toHaveBeenCalled()
    expect(value.state.state.error).toContain('API 请求规则不允许访问此地址')
    const allowed = setup(
      {
        actions: [{ type: 'request', url: 'https://api.example.com/save' }],
        loadingPath: '/loading',
        errorPath: '/error',
        onError: [
          {
            type: 'local',
            actions: [{ type: 'setState', path: '/notice', value: { $error: '/message' } }],
          },
        ],
      },
      { requests: { allow: () => true, fetch } },
    )
    await allowed.events.fire(allowed.node, 'click')
    expect(allowed.state.state.loading).toBe(false)
    expect(allowed.state.state.error).toContain('HTTP 422')
    expect(allowed.state.state.notice).toContain('参数 name 不能为空')
    expect(allowed.reports.at(-1)).toMatchObject({ phase: 'error' })
  })
  it('reports unregistered callbacks without evaluating JS text', async () => {
    const value = setup({ actions: [{ type: 'callback', name: 'notRegistered' }] })
    await value.events.fire(value.node, 'click')
    expect(value.errors[0]).toBeInstanceOf(Error)
    expect(value.reports.at(-1)?.error).toContain('尚未在宿主中注册')
  })
  it('drops duplicate triggers while running and aborts superseded callback commits', async () => {
    const resolvers: Array<(result: unknown) => void> = [],
      contexts: any[] = []
    const callback = vi.fn((_args, context) => {
      contexts.push(context)
      return new Promise((resolve) => resolvers.push(resolve))
    })
    const first = setup(
      { actions: [{ type: 'callback', name: 'wait' }], resultPath: '/response' },
      { callbacks: { wait: callback } },
    )
    const running = first.events.fire(first.node, 'click')
    await settle()
    await first.events.fire(first.node, 'click')
    expect(callback).toHaveBeenCalledTimes(1)
    resolvers[0]!('first')
    await running
    const latest = setup(
      {
        actions: [{ type: 'callback', name: 'wait' }],
        resultPath: '/response',
        concurrency: 'latest',
      },
      { callbacks: { wait: callback } },
    )
    const old = latest.events.fire(latest.node, 'click')
    await settle()
    const current = latest.events.fire(latest.node, 'click')
    await settle()
    expect(contexts[1].signal.aborted).toBe(true)
    expect(() => contexts[1].setState('/count', 99)).toThrow()
    resolvers[2]!('new')
    await current
    resolvers[1]!('old')
    await old
    expect(latest.state.state.response).toBe('new')
    expect(latest.reports.map((report) => report.phase)).toContain('cancelled')
  })
  it('debounces changing inputs and cancels pending work on destroy', async () => {
    vi.useFakeTimers()
    const callback = vi.fn(async (args) => args)
    const value = setup(
      {
        actions: [{ type: 'callback', name: 'search', args: { $event: '/value' } }],
        debounceMs: 300,
        concurrency: 'latest',
      },
      { callbacks: { search: callback } },
    )
    const input: ComponentNode = {
      ...value.node,
      component: 'TextField',
      value: { path: '/query' },
      events: { change: value.node.events!.click! },
    }
    await value.events.fire(input, 'change', { value: 'a' })
    await value.events.fire(input, 'change', { value: 'ab' })
    await vi.advanceTimersByTimeAsync(299)
    expect(callback).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(callback.mock.calls[0]?.[0]).toBe('ab')
    await value.events.fire(input, 'change', { value: 'abc' })
    value.events.destroy()
    await vi.advanceTimersByTimeAsync(500)
    expect(callback).toHaveBeenCalledTimes(1)
  })
  it('times out a callback and rejects state writes after timeout or destruction', async () => {
    vi.useFakeTimers()
    let context: any
    const callback = vi.fn((_args, value) => {
      context = value
      return new Promise(() => {})
    })
    const value = setup(
      {
        actions: [{ type: 'callback', name: 'wait', timeoutMs: 100 }],
        loadingPath: '/loading',
        errorPath: '/error',
      },
      { callbacks: { wait: callback } },
    )
    const pending = value.events.fire(value.node, 'click')
    await settle()
    await vi.advanceTimersByTimeAsync(101)
    await pending
    expect(value.state.state.error).toContain('执行超时')
    expect(value.state.state.loading).toBe(false)
    expect(() => context.setState('/count', 9)).toThrow()
    const running = value.events.fire(value.node, 'click')
    await settle()
    value.events.destroy()
    await running
    expect(context.signal.aborted).toBe(true)
  })
  it.each([new Response('plain text', { status: 200 }), new Response(null, { status: 204 })])(
    'handles text and no-content responses',
    async (response) => {
      const value = setup(
        {
          actions: [{ type: 'request', url: 'https://example.com/data', response: 'text' }],
          resultPath: '/response',
        },
        { requests: { allow: () => true, fetch: vi.fn(async () => response) } },
      )
      await value.events.fire(value.node, 'click')
      expect(value.state.state.response).toBe(response.status === 204 ? null : 'plain text')
    },
  )
  it('preserves literal API JSON including path/op fields and reports network failures', async () => {
    const value = setup(
      {
        actions: [
          { type: 'callback', name: 'data' },
          {
            type: 'local',
            actions: [{ type: 'setState', path: '/response', value: { $result: '/' } }],
          },
        ],
      },
      { callbacks: { data: () => ({ path: 'business-path', op: 'business-op', args: [] }) } },
    )
    await value.events.fire(value.node, 'click')
    expect(value.state.state.response).toEqual({
      path: 'business-path',
      op: 'business-op',
      args: [],
    })
    const network = setup(
      { actions: [{ type: 'request', url: 'https://example.com' }], errorPath: '/error' },
      {
        requests: {
          allow: () => true,
          fetch: vi.fn(async () => {
            throw new TypeError('Failed to fetch')
          }),
        },
      },
    )
    await network.events.fire(network.node, 'click')
    expect(network.state.state.error).toContain('CORS')
  })
  it('keeps a shared loading path true until all events finish', async () => {
    const finishes: Array<(value: unknown) => void> = []
    const value = setup(
      { actions: [{ type: 'callback', name: 'wait' }], loadingPath: '/loading' },
      { callbacks: { wait: () => new Promise((resolve) => finishes.push(resolve)) } },
    )
    const other = { ...value.node, id: 'another' }
    const first = value.events.fire(value.node, 'click'),
      second = value.events.fire(other, 'click')
    await settle()
    finishes[0]!(null)
    await first
    expect(value.state.state.loading).toBe(true)
    finishes[1]!(null)
    await second
    expect(value.state.state.loading).toBe(false)
  })
  it('rejects excessive or unsafe API response data', async () => {
    const fetch = vi.fn(async () => new Response('x'.repeat(262145)))
    const value = setup(
      { actions: [{ type: 'request', url: 'https://example.com/data' }], errorPath: '/error' },
      { requests: { allow: () => true, fetch } },
    )
    await value.events.fire(value.node, 'click')
    expect(value.state.state.error).toContain('256 KiB')
  })
})
describe('portable event configuration', () => {
  const node: ComponentNode = {
    id: 'save',
    component: 'Button',
    child: 'label',
    events: { click: { actions: [{ type: 'callback', name: 'onSave' }] } },
  }
  function doc(next: ComponentNode) {
    return {
      schemaVersion: 'lingui.document/2' as const,
      title: '事件',
      parameters: [],
      state: {},
      source: serializeSource([
        { id: 'root', component: 'Column', children: ['save'] },
        next,
        { id: 'label', component: 'Text', text: '保存' },
      ]),
    }
  }
  it('accepts callback-only buttons and validates event capabilities for every registered component', () => {
    expect(validateDocument(doc(node)).source).toContain('onSave')
    for (const component of componentNames) {
      expect(new Set(supportedEvents(component)).size).toBe(supportedEvents(component).length)
      expect(supportedEvents(component)).toContain('mount')
    }
    expect(supportedEvents('LingUI.ColorPicker')).toContain('change')
    expect(supportedEvents('LingUI.FormGroup')).toContain('submit')
    expect(supportedEvents('Divider')).toEqual(['mount'])
  })
  it.each([
    { click: { actions: [{ type: 'request', url: 'javascript:alert(1)' }] } },
    {
      click: {
        actions: [
          { type: 'request', url: 'https://example.com', headers: { Authorization: 'secret' } },
        ],
      },
    },
    { click: { actions: [{ type: 'request', url: '/api', body: { a: 1 } }] } },
    { click: { actions: [{ type: 'callback', name: 'save', code: 'alert(1)' }] } },
    { click: { actions: [{ type: 'callback', name: 'save' }], loadingPath: '/constructor/value' } },
    { submit: { actions: [{ type: 'callback', name: 'save' }] } },
    { click: { actions: [] } },
    {
      click: {
        actions: [{ type: 'callback', name: 'save', args: { $state: '/constructor/value' } }],
      },
    },
    { click: { actions: [{ type: 'callback', name: 'save', args: { $event: 5 } }] } },
  ])('rejects invalid event declarations', (events) => {
    expect(() => validateDocument(doc({ ...node, events: events as never }))).toThrow()
  })
})
