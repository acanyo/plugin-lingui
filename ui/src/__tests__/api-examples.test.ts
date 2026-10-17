import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  apiExamples,
  apiExamplePrefix,
  createEventRuntime,
  createRuntime,
  createInstance,
  resolveCollectionNode,
  resolveDocument,
  validateDocument,
  type ComponentEventName,
  type EventReport,
} from '@lingui/renderer'
import { createDemoRequests, isDemoApi } from '@lingui/renderer'
import MarketPreview from '../marketplace/MarketPreview.vue'
import WorkDetail from '../marketplace/WorkDetail.vue'

const events: ReturnType<typeof createEventRuntime>[] = []
let view: VueWrapper | undefined
afterEach(() => {
  events.splice(0).forEach((event) => event.destroy())
  view?.unmount()
  view = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
function setup(id: string, latencyMs = 0) {
  const definition = validateDocument(apiExamples.find((example) => example.id === id)!.create())
  const resolved = resolveDocument(definition)
  const state = createRuntime(resolved.state)
  const reports: EventReport[] = []
  const requests = createDemoRequests({ latencyMs })
  const runtime = createEventRuntime(state, {
    inheritRegistered: false,
    apis: Object.fromEntries(definition.integrations!.apis.map((api) => [api.name, api])),
    requests,
    onEvent: (report) => reports.push(report),
  })
  events.push(runtime)
  return {
    state,
    nodes: resolved.nodes,
    reports,
    fire: (node = 'load', event: ComponentEventName = 'click') =>
      runtime.fire(resolved.nodes[node]!, event),
  }
}

describe('API example workflows', () => {
  it.each(apiExamples)(
    '$title is valid and all declared APIs include request/response contracts',
    (example) => {
      const definition = validateDocument(example.create())
      expect(definition.integrations?.apis.length).toBeGreaterThan(0)
      for (const api of definition.integrations!.apis) {
        expect(isDemoApi(api)).toBe(true)
        expect(api.inputExample).toBeDefined()
        expect(api.responseExample).toBeDefined()
      }
    },
  )
  it('queries, maps, selects and clears search results without using the network', async () => {
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    const { state, nodes, fire } = setup('api-search')
    state.set({ path: '/query' }, 'Flux')
    const request = fire()
    expect(state.state.loading).toBe(true)
    await request
    expect(state.state.loading).toBe(false)
    const items = resolveCollectionNode(nodes.results!, state.state).node.items!
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ label: 'Spring Flux 入门' })
    await events.at(-1)!.fire(nodes.results!, 'select', { item: items[0]! })
    expect(state.state.selected).toMatchObject({ label: 'Spring Flux 入门' })
    state.set({ path: '/query' }, '不存在的条目')
    await fire('query', 'search')
    expect(resolveCollectionNode(nodes.results!, state.state).empty).toBe(true)
    expect(network).not.toHaveBeenCalled()
  })
  it('sends the current page and maps distinct table rows', async () => {
    const { state, nodes, fire } = setup('api-pagination')
    await fire()
    const first = resolveCollectionNode(nodes.table!, state.state).node.rows!
    expect(first).toHaveLength(3)
    state.set({ path: '/page' }, 2)
    await fire('pages', 'change')
    const second = resolveCollectionNode(nodes.table!, state.state).node.rows!
    expect(second).toHaveLength(3)
    expect(second[0]!.label).not.toBe(first[0]!.label)
    expect(state.state.response).toMatchObject({ page: 2, total: 9 })
  })
  it('submits bound fields, reports server validation and returns a simulated receipt', async () => {
    const { state, fire, reports } = setup('api-submission')
    await fire('form', 'submit')
    expect(state.state.error).toContain('HTTP 422')
    state.set({ path: '/name' }, '小林')
    state.set({ path: '/message' }, '希望增加更多接口案例。')
    await fire('form', 'submit')
    expect(state.state.error).toBe('')
    expect(state.state.receipt).toMatchObject({
      accepted: true,
      message: expect.stringContaining('未实际保存'),
    })
    expect(reports.at(-1)?.phase).toBe('success')
  })
  it('updates chart numbers and display cells from the same filtered response', async () => {
    const { state, nodes, fire } = setup('api-metrics')
    await fire()
    expect(resolveCollectionNode(nodes.chart!, state.state).node.data![0]!.value).toBe(128)
    state.set({ path: '/period' }, 'month')
    await fire('period', 'change')
    expect(resolveCollectionNode(nodes.chart!, state.state).node.data![0]!.value).toBe(512)
    expect(resolveCollectionNode(nodes.table!, state.state).node.rows![0]!.cells).toEqual(['512'])
  })
  it('exposes HTTP 503, retries successfully and isolates attempts per preview', async () => {
    const first = setup('api-retry')
    await first.fire()
    expect(first.state.state).toMatchObject({
      loading: false,
      error: expect.stringContaining('HTTP 503'),
    })
    await first.fire('results', 'retry')
    expect(first.state.state.error).toBe('')
    expect(
      resolveCollectionNode(first.nodes.results!, first.state.state).node.items![0]!.label,
    ).toBe('业务接口可用')
    const second = setup('api-retry')
    await second.fire()
    expect(second.state.state.error).toContain('HTTP 503')
  })
  it('cancels replaced requests and never applies a result after disposal', async () => {
    vi.useFakeTimers()
    const { state, reports, fire } = setup('api-search', 100)
    state.set({ path: '/query' }, 'Flux')
    const first = fire()
    await vi.advanceTimersByTimeAsync(10)
    state.set({ path: '/query' }, 'JVM')
    const latest = fire()
    await vi.runAllTimersAsync()
    await Promise.all([first, latest])
    expect(state.state.response).toMatchObject({ items: [{ name: 'JVM 内存结构' }] })
    expect(reports.some((report) => report.phase === 'cancelled')).toBe(true)
    const pending = fire()
    events.at(-1)!.destroy()
    await vi.runAllTimersAsync()
    await pending
    expect(reports.at(-1)?.phase).toBe('cancelled')
  })
})

describe('demo transport boundaries', () => {
  it('intercepts only local reserved paths and never falls through unknown demo routes', async () => {
    const network = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', network)
    const requests = createDemoRequests({ latencyMs: 0 })
    expect(requests.allow(new URL('https://api.example.com/articles'), 'GET')).toBe(false)
    expect(isDemoApi({ url: `https://api.example.com${apiExamplePrefix}articles` })).toBe(false)
    await expect(requests.fetch!('https://api.example.com/articles')).rejects.toThrow('未启用真实')
    expect((await requests.fetch!(`${apiExamplePrefix}missing`)).status).toBe(404)
    expect(
      (await requests.fetch!(`${apiExamplePrefix}articles`, { method: 'DELETE' })).status,
    ).toBe(404)
    expect(network).not.toHaveBeenCalled()
    let enabled = false
    const editable = createDemoRequests({ allowReal: () => enabled })
    enabled = true
    await editable.fetch!('https://api.example.com/articles')
    expect(network).toHaveBeenCalledTimes(1)
  })
})

describe('API applications in the market', () => {
  const settle = async () => {
    await flushPromises()
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
  }
  it('runs and resets the failure/retry workflow in the market detail preview', async () => {
    vi.useFakeTimers()
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    const application = apiExamples.find((example) => example.id === 'api-retry')!
    view = mount(MarketPreview, {
      props: { instance: createInstance(application.create()) },
      attachTo: document.body,
    })
    await flushPromises()
    const root = () => view!.get('.lingui-renderer-host').element.shadowRoot!
    root().querySelector<HTMLButtonElement>('[data-lingui-node="load"]')!.click()
    await settle()
    expect(root().textContent).toContain('HTTP 503')
    const retry = [...root().querySelectorAll('button')].find((button) =>
      button.textContent?.includes('重新加载'),
    )!
    retry.click()
    await settle()
    expect(root().textContent).toContain('业务接口可用')
    await view.get('[aria-label="重置预览"]').trigger('click')
    await flushPromises()
    root().querySelector<HTMLButtonElement>('[data-lingui-node="load"]')!.click()
    await settle()
    expect(root().textContent).toContain('HTTP 503')
    expect(network).not.toHaveBeenCalled()
  })
  it('shows the contract and calls configured real APIs in work details, including after reset', async () => {
    vi.useFakeTimers()
    const network = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [{ id: 'real', name: '真实接口结果', summary: '已从接口加载' }],
          }),
        ),
    )
    vi.stubGlobal('fetch', network)
    const application = apiExamples[0]!
    const instance = createInstance(application.create())
    instance.document.integrations!.apis[0]!.url = 'https://api.example.com/articles'
    view = mount(WorkDetail, {
      props: {
        work: {
          ...application,
          instance,
          source: 'community',
          publisher: '灵构 UI',
          license: 'GPL-3.0',
          version: '1.1.0',
        },
      },
      global: { stubs: { StudioModal: { template: '<div><slot/><slot name="footer"/></div>' } } },
      attachTo: document.body,
    })
    await flushPromises()
    expect(view.text()).toContain('查询参数')
    expect(view.text()).toContain('响应示例')
    const root = () => view!.get('.lingui-renderer-host').element.shadowRoot!
    expect(network).not.toHaveBeenCalled()
    root().querySelector<HTMLButtonElement>('[data-lingui-node="load"]')!.click()
    await settle()
    expect(root().textContent).toContain('真实接口结果')
    expect(network).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('https://api.example.com/articles'),
      expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
    )
    await view.get('[aria-label="重置预览"]').trigger('click')
    await flushPromises()
    root().querySelector<HTMLButtonElement>('[data-lingui-node="load"]')!.click()
    await settle()
    expect(network).toHaveBeenCalledTimes(2)
    expect(root().textContent).toContain('真实接口结果')
  })
})
