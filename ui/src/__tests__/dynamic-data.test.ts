import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createInstance,
  createRuntime,
  createEventRuntime,
  mountRenderer,
  resolveCollectionNode,
  serializeSource,
  validateDocument,
  validateIntegrations,
  workDependencies,
  mapWorkDependencies,
  type ComponentNode,
  type RendererHandle,
} from '@lingui/renderer'
import { document as defineDocument, text } from '../../../packages/renderer/src/examples/builders'
const handles: RendererHandle[] = []
afterEach(async () => {
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  window.document.body.replaceChildren()
  vi.unstubAllGlobals()
})
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
const list: ComponentNode = {
  id: 'list',
  component: 'List',
  children: [],
  items: [],
  bindings: {
    items: { path: '/response/items', map: { id: '/id', label: '/name', description: '/summary' } },
  },
  dataState: {
    loading: { path: '/loading' },
    error: { path: '/error' },
    emptyText: '没有匹配结果',
  },
}
const apis = [
  {
    name: 'search',
    label: '查询数据',
    url: '/business-api/items',
    method: 'GET' as const,
    inputExample: { q: '' },
    responseExample: { items: [{ id: '1', name: '示例', summary: '描述' }] },
  },
  { name: 'save', label: '保存', url: '/business-api/items', method: 'POST' as const },
]
describe('dynamic collection data', () => {
  it('maps records into tables, charts and selectable lists without changing state', () => {
    const state = { response: { items: [{ id: '1', name: 'Flux', summary: '响应式', count: 4 }] } }
    expect(resolveCollectionNode(list, state).node.items).toEqual([
      { id: '1', label: 'Flux', description: '响应式' },
    ])
    expect(
      resolveCollectionNode(
        {
          id: 'chart',
          component: 'LingUI.BarChart',
          label: '图表',
          data: [],
          bindings: { data: { path: '/response/items', map: { label: '/name', value: '/count' } } },
        },
        state,
      ).node.data,
    ).toEqual([{ label: 'Flux', value: 4 }])
    expect(
      resolveCollectionNode(
        {
          id: 'table',
          component: 'LingUI.Table',
          label: '列表',
          columns: ['名称', '描述'],
          rows: [],
          bindings: {
            rows: { path: '/response/items', map: { label: '/name', cells: ['/summary'] } },
          },
        },
        state,
      ).node.rows,
    ).toEqual([{ label: 'Flux', cells: ['响应式'] }])
    expect(state.response.items[0]!.name).toBe('Flux')
  })
  it('shows missing/empty collections and rejects mismatched fields, counts and structural bindings', () => {
    expect(resolveCollectionNode(list, {}).empty).toBe(true)
    expect(() => resolveCollectionNode(list, { response: { items: 'invalid' } })).toThrow(
      '需要数组',
    )
    expect(() => resolveCollectionNode(list, { response: { items: [{}] } })).toThrow('不存在')
    expect(() =>
      resolveCollectionNode(
        { ...list, bindings: { items: { path: '/rows' } } },
        { rows: Array.from({ length: 101 }, () => ({ label: 'x' })) },
      ),
    ).toThrow('数量限制')
    const definition = defineDocument('作品', [list], {})
    expect(() =>
      validateDocument({
        ...definition,
        source: serializeSource([
          {
            ...list,
            id: 'root',
            bindings: { children: { path: '/items' } },
          } as unknown as ComponentNode,
        ]),
      }),
    ).toThrow('目录')
  })
  it('checks unsafe mappings and cyclic dynamic trees', () => {
    expect(() =>
      validateDocument(
        defineDocument(
          '作品',
          [
            {
              ...list,
              id: 'root',
              bindings: { items: { path: '/response/items', map: { label: '/constructor' } } },
            },
          ],
          {},
        ),
      ),
    ).toThrow('不安全')
    expect(() =>
      resolveCollectionNode(
        {
          id: 'tree',
          component: 'LingUI.TreeView',
          label: '树',
          value: { path: '/selected' },
          treeItems: [],
          bindings: { treeItems: { path: '/tree' } },
        },
        { tree: [{ id: 'x', label: '节点', parent: 'x' }] },
      ),
    ).toThrow('循环')
  })
})
describe('named business capabilities', () => {
  it('sends named GET/POST parameters, preserves literal response business fields and reports missing declarations', async () => {
    const request = vi.fn(
      async (_url: Parameters<typeof globalThis.fetch>[0], _options?: RequestInit) =>
        new Response('{"saved":true}'),
    )
    const state = createRuntime({ query: 'Flux', body: { path: 'business-path' } })
    const reports: unknown[] = []
    const events = createEventRuntime(state, {
      apis: Object.fromEntries(apis.map((api) => [api.name, api])),
      requests: { allow: () => true, fetch: request },
      onEvent: (value) => reports.push(value),
    })
    const node: ComponentNode = {
      id: 'send',
      component: 'Button',
      child: 'label',
      events: {
        click: {
          actions: [
            { type: 'api', name: 'search', args: { q: { $state: '/query' } } },
            { type: 'api', name: 'save', args: { $state: '/body' }, resultPath: '/result' },
          ],
        },
      },
    }
    await events.fire(node, 'click', null)
    expect(request.mock.calls[0]![0]).toContain('q=Flux')
    expect(JSON.parse(request.mock.calls[1]![1]!.body as string)).toEqual({ path: 'business-path' })
    expect(state.state.result).toEqual({ saved: true })
    await events.fire(
      { ...node, events: { click: { actions: [{ type: 'api', name: 'missing' }] } } },
      'click',
      null,
    )
    expect(reports.at(-1)).toMatchObject({
      phase: 'error',
      error: expect.stringContaining('尚未配置'),
    })
    events.destroy()
  })
  it('validates unique definitions, safe endpoints, literal example fields, and unknown script/credential fields', () => {
    expect(() =>
      validateIntegrations({
        apis,
        callbacks: [{ name: 'onSaved', label: '保存后', inputExample: { path: 'business-path' } }],
      }),
    ).not.toThrow()
    expect(() => validateIntegrations({ apis: [apis[0], apis[0]], callbacks: [] })).toThrow('重复')
    expect(() =>
      validateIntegrations({ apis: [{ ...apis[0], url: 'javascript:alert(1)' }], callbacks: [] }),
    ).toThrow()
    expect(() =>
      validateIntegrations({ apis: [{ ...apis[0], token: 'secret' }], callbacks: [] }),
    ).toThrow('格式')
    expect(() =>
      validateIntegrations({ apis: [], callbacks: [{ name: 'x', label: 'x', code: 'alert(1)' }] }),
    ).toThrow('格式')
  })
})
describe('search, detail and form workflow', () => {
  it('renders loading, results, selection details, failed submit and successful retry using primitives', async () => {
    let resolveSearch!: (value: Response) => void
    let failed = true
    const fetch = vi.fn(async (url: Parameters<typeof globalThis.fetch>[0]) => {
      if (String(url).includes('q='))
        return await new Promise<Response>((resolve) => {
          resolveSearch = resolve
        })
      if (failed) return new Response('{"detail":"名称不能为空"}', { status: 422 })
      return new Response('{"saved":true}')
    })
    const searchBinding = {
      actions: [{ type: 'api' as const, name: 'search', args: { q: { $state: '/query' } } }],
      resultPath: '/response',
      loadingPath: '/loading',
      errorPath: '/error',
      concurrency: 'latest' as const,
    }
    const definition = defineDocument(
      '数据流程',
      [
        {
          id: 'root',
          component: 'Column',
          children: ['search', 'list', 'detail', 'form', 'notice'],
        },
        {
          id: 'search',
          component: 'LingUI.SearchInput',
          label: '搜索',
          value: { path: '/query' },
          events: { search: searchBinding },
        },
        {
          ...list,
          events: {
            retry: searchBinding,
            select: {
              actions: [
                {
                  type: 'local',
                  actions: [
                    { type: 'setState', path: '/selected', value: { $event: '/item/label' } },
                  ],
                },
              ],
            },
          },
        },
        { id: 'detail', component: 'Text', text: { path: '/selected' } },
        {
          id: 'form',
          component: 'LingUI.FormGroup',
          label: '保存表单',
          child: 'form-fields',
          events: {
            submit: {
              actions: [{ type: 'api', name: 'save', args: { name: { $state: '/name' } } }],
              errorPath: '/saveError',
              onSuccess: [
                {
                  type: 'local',
                  actions: [{ type: 'setState', path: '/notice', value: '保存成功' }],
                },
              ],
              onError: [
                {
                  type: 'local',
                  actions: [{ type: 'setState', path: '/notice', value: { $error: '/message' } }],
                },
              ],
            },
          },
        },
        { id: 'form-fields', component: 'Column', children: ['name', 'submit'] },
        { id: 'name', component: 'TextField', label: '名称', value: { path: '/name' } },
        { id: 'submit', component: 'Button', child: 'submit-label', buttonType: 'submit' },
        text('submit-label', '提交'),
        { id: 'notice', component: 'Text', text: { path: '/notice' } },
      ],
      { query: 'Flux', loading: false, error: '', selected: '', name: '', notice: '' },
    )
    definition.integrations = { apis, callbacks: [] }
    const element = window.document.createElement('div')
    window.document.body.append(element)
    handles.push(
      mountRenderer(element, createInstance(definition), {
        inheritRegistered: false,
        requests: { allow: () => true, fetch },
      }),
    )
    await settle()
    const root = element.shadowRoot!
    expect(root.textContent).toContain('没有匹配结果')
    root
      .querySelector<HTMLInputElement>('[data-lingui-node="search"] input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await settle()
    expect(root.textContent).toContain('正在加载数据')
    resolveSearch(new Response('{"items":[{"id":"1","name":"Flux 原理","summary":"点击查看"}]}'))
    await settle()
    await settle()
    expect(root.textContent).toContain('Flux 原理')
    root.querySelector<HTMLButtonElement>('.lg-data-list-item')!.click()
    await settle()
    expect(root.querySelector('[data-lingui-node="detail"]')!.textContent).toBe('Flux 原理')
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
    await settle()
    expect(root.querySelector('[data-lingui-node="notice"]')!.textContent).toContain('名称不能为空')
    failed = false
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
    await settle()
    expect(root.querySelector('[data-lingui-node="notice"]')!.textContent).toBe('保存成功')
  })
})
describe('marketplace dependency mapping', () => {
  it('derives dependencies from all branches and maps endpoints and callbacks without changing original work', () => {
    const instance = createInstance(
      defineDocument(
        '市场作品',
        [
          {
            id: 'root',
            component: 'Button',
            child: 'label',
            events: {
              click: {
                actions: [
                  { type: 'api', name: 'search' },
                  { type: 'request', url: '/legacy', method: 'POST' },
                ],
                onSuccess: [{ type: 'callback', name: 'afterSave' }],
                onError: [{ type: 'api', name: 'missing' }],
              },
            },
          },
          text('label', '按钮'),
        ],
        {},
      ),
    )
    instance.document.integrations = { apis, callbacks: [{ name: 'afterSave', label: '保存后' }] }
    expect(workDependencies(instance)).toHaveLength(4)
    const targets = {
      apis: [
        { name: 'localSearch', label: '本站搜索', method: 'GET' as const, url: '/own/items' },
        { name: 'localSave', label: '本站保存', method: 'POST' as const, url: '/own/save' },
      ],
      callbacks: [{ name: 'hostSaved', label: '宿主保存后' }],
    }
    const mapped = mapWorkDependencies(instance, targets, {
      'api:search': 'localSearch',
      'request:POST /legacy': 'localSave',
      'callback:afterSave': 'hostSaved',
    })
    expect(workDependencies(mapped)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'api', name: 'search', url: '/own/items' }),
        expect.objectContaining({ kind: 'request', url: '/own/save' }),
        expect.objectContaining({ kind: 'callback', name: 'hostSaved' }),
      ]),
    )
    expect(workDependencies(instance).find((item) => item.name === 'search')!.url).toBe(
      '/business-api/items',
    )
    expect(() =>
      mapWorkDependencies(instance, targets, { 'request:POST /legacy': 'localSearch' }),
    ).toThrow('相同请求方法')
  })
})
