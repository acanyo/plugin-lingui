import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  createInstance,
  validateDocument,
  resolveDocument,
  type ComponentInstance,
  type ComponentNode,
} from '@lingui/renderer'
import IntegrationManager from '../integrations/IntegrationManager.vue'
import DataBindingEditor from '../component-studio/DataBindingEditor.vue'
import DependencyMappingDialog from '../integrations/DependencyMappingDialog.vue'
import { createBlankDocument } from '../component-studio/document-editor'
import { contractDocument } from './fixtures/response-contract'
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
const stub = { template: '<section><slot/><slot name="footer"/></section>' }
async function click(text: string) {
  await wrapper!
    .findAll('button')
    .find((button) => button.text().trim() === text)!
    .trigger('click')
  await flushPromises()
}
function manager(instance = createInstance(createBlankDocument())) {
  wrapper = mount(IntegrationManager, {
    props: { instance },
    global: { stubs: { StudioModal: stub } },
    attachTo: document.body,
  })
  return wrapper
}
describe('interface and callback editor', () => {
  it('compares with the saved example until explicitly saved, and emits affected component IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"items":[]}')),
    )
    manager(createInstance(contractDocument()))
    await wrapper!.get('.lu-integration-item').trigger('click')
    await click('用参数示例测试')
    const panel = wrapper!.get('[aria-label="接口字段变化"]')
    expect(panel.text()).toContain('/temperature')
    expect(panel.text()).toContain('字段缺失')
    await click('采用为响应示例')
    expect(panel.text()).toContain('/temperature')
    expect(wrapper!.emitted('update')).toBeUndefined()
    await panel.get('[aria-label="定位组件 metric 的 value"]').trigger('click')
    expect(wrapper!.emitted('locate')![0]![0]).toEqual({
      nodeId: 'metric',
      property: 'value',
      path: '/response/temperature',
    })
  })
  it('does not associate a changed endpoint with the saved API consumers or emit its sample', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    )
    manager(createInstance(contractDocument()))
    await wrapper!.get('.lu-integration-item').trigger('click')
    await wrapper!
      .get('input[placeholder="/business-api/articles"]')
      .setValue('https://api.example.com/other')
    await click('用参数示例测试')
    expect(wrapper!.get('[aria-label="接口字段变化"]').text()).toContain('字段缺失')
    expect(wrapper!.find('[aria-label="定位组件 metric 的 value"]').exists()).toBe(false)
    expect(wrapper!.emitted('sample')).toBeUndefined()
  })
  it.each(['GET', 'POST'] as const)(
    'tests a configured %s API directly from its parameter examples',
    async (method) => {
      const network = vi.fn(async () => new Response('{"temperature":21}'))
      vi.stubGlobal('fetch', network)
      const instance = createInstance(createBlankDocument())
      instance.document.integrations = {
        apis: [
          {
            name: 'weather',
            label: '天气',
            method,
            url: 'https://api.example.com/weather',
            inputExample: { city: 'Beijing' },
          },
        ],
        callbacks: [],
      }
      manager(instance)
      await wrapper!.get('.lu-integration-item').trigger('click')
      expect(wrapper!.find('input[type="checkbox"]').exists()).toBe(false)
      await click('用参数示例测试')
      await flushPromises()
      expect(network).toHaveBeenCalledTimes(1)
      const [url, options] = network.mock.calls[0]! as unknown as [string, RequestInit]
      expect(options).toMatchObject({ method, credentials: 'omit' })
      if (method === 'GET') expect(new URL(url).searchParams.get('city')).toBe('Beijing')
      else expect(options.body).toBe('{"city":"Beijing"}')
      expect(wrapper!.get('[aria-label="API 测试结果"]').text()).toContain('21')
      expect(wrapper!.emitted('sample')?.[0]).toEqual(['weather', { temperature: 21 }])
      expect(wrapper!.get<HTMLTextAreaElement>('textarea[rows="6"]').element.value).toBe('{}')
      await click('采用为响应示例')
      expect(
        JSON.parse(wrapper!.get<HTMLTextAreaElement>('textarea[rows="6"]').element.value),
      ).toEqual({
        temperature: 21,
      })
      expect(wrapper!.emitted('update')).toBeUndefined()
      await click('保存配置')
      const saved = wrapper!.emitted('update')![0]![0] as ComponentInstance
      expect(saved.document.integrations!.apis[0]!.responseExample).toEqual({ temperature: 21 })
    },
  )
  function weatherManager() {
    const instance = createInstance(createBlankDocument())
    instance.document.integrations = {
      apis: [
        {
          name: 'weather',
          label: '天气',
          url: 'https://api.example.com/weather',
          method: 'GET',
          inputExample: {},
        },
      ],
      callbacks: [],
    }
    manager(instance)
    return wrapper!.get('.lu-integration-item').trigger('click')
  }
  it.each(['null', 'false', '0'])(
    'adopts a successful %s JSON response without losing its value',
    async (body) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body)),
      )
      await weatherManager()
      await click('用参数示例测试')
      await click('采用为响应示例')
      expect(wrapper!.get<HTMLTextAreaElement>('textarea[rows="6"]').element.value).toBe(body)
      await click('保存配置')
      const saved = wrapper!.emitted('update')![0]![0] as ComponentInstance
      expect(saved.document.integrations!.apis[0]!.responseExample).toEqual(JSON.parse(body))
      await wrapper!.setProps({ instance: saved })
      await wrapper!.get('.lu-integration-item').trigger('click')
      expect(wrapper!.get<HTMLTextAreaElement>('textarea[rows="6"]').element.value).toBe(body)
    },
  )
  it.each(['url', 'method', 'input'])(
    'discards results when the request %s changes',
    async (field) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{"temperature":21}')),
      )
      await weatherManager()
      await click('用参数示例测试')
      expect(wrapper!.text()).toContain('采用为响应示例')
      const selector =
        field === 'url'
          ? 'input[placeholder="/business-api/articles"]'
          : field === 'method'
            ? 'select'
            : 'textarea[rows="5"]'
      await wrapper!
        .get(selector)
        .setValue(
          field === 'url' ? '/different' : field === 'method' ? 'POST' : '{"city":"Shanghai"}',
        )
      expect(wrapper!.text()).not.toContain('采用为响应示例')
      expect(wrapper!.find('[aria-label="API 测试结果"]').exists()).toBe(false)
      expect(wrapper!.get<HTMLTextAreaElement>('textarea[rows="6"]').element.value).toBe('{}')
    },
  )
  it('clears a previous success when retesting fails', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"temperature":21}'))
      .mockResolvedValueOnce(new Response('{"message":"服务不可用"}', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    await weatherManager()
    await click('用参数示例测试')
    await click('用参数示例测试')
    expect(wrapper!.text()).toContain('HTTP 503')
    expect(wrapper!.text()).not.toContain('采用为响应示例')
    expect(wrapper!.find('[aria-label="API 测试结果"]').exists()).toBe(false)
  })
  it('ignores an in-flight response after request parameters are edited', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      ),
    )
    await weatherManager()
    await click('用参数示例测试')
    await wrapper!.get('textarea[rows="5"]').setValue('{"city":"Shanghai"}')
    finish(new Response('{"temperature":21}'))
    await flushPromises()
    expect(wrapper!.emitted('sample')).toBeUndefined()
    expect(wrapper!.text()).not.toContain('采用为响应示例')
    expect(wrapper!.find('[aria-label="API 测试结果"]').exists()).toBe(false)
  })
  it('adds an API with examples, keeps it on the document and validates duplicate identifiers', async () => {
    manager()
    await click('新增接口')
    await wrapper!.get('input[placeholder="搜索文章"]').setValue('搜索文章')
    await wrapper!.get('input[placeholder="searchArticles"]').setValue('searchArticles')
    await wrapper!
      .get('input[placeholder="/business-api/articles"]')
      .setValue('/business-api/articles')
    await wrapper!.get('textarea[rows="5"]').setValue('{"q":""}')
    await wrapper!
      .get('textarea[rows="6"]')
      .setValue('{"items":[{"name":"示例","path":"literal-business-path"}]}')
    await click('保存配置')
    const saved = wrapper!.emitted('update')![0]![0] as ComponentInstance
    expect(saved.document.integrations?.apis[0]).toMatchObject({
      name: 'searchArticles',
      responseExample: { items: [{ name: '示例', path: 'literal-business-path' }] },
    })
    expect(() => validateDocument(saved.document)).not.toThrow()
    await wrapper!.setProps({ instance: saved })
    await click('新增接口')
    await wrapper!.get('input[placeholder="搜索文章"]').setValue('重复项')
    await wrapper!.get('input[placeholder="searchArticles"]').setValue('searchArticles')
    await wrapper!.get('input[placeholder="/business-api/articles"]').setValue('/another')
    await click('保存配置')
    expect(wrapper!.text()).toContain('名称已存在')
    expect(wrapper!.emitted('update')).toHaveLength(1)
  })
  it('declares callbacks without executable code and rejects broken JSON', async () => {
    manager()
    await click('JS 回调')
    await click('新增回调')
    await wrapper!.get('input[placeholder="搜索文章"]').setValue('选择后')
    await wrapper!.get('input[placeholder="searchArticles"]').setValue('onSelected')
    await wrapper!.get('textarea[rows="5"]').setValue('{bad')
    await click('保存配置')
    expect(wrapper!.emitted('update')).toBeUndefined()
    await wrapper!.get('textarea[rows="5"]').setValue('{"id":1}')
    await click('保存配置')
    expect(
      (wrapper!.emitted('update')![0]![0] as ComponentInstance).document.integrations,
    ).toMatchObject({ apis: [], callbacks: [{ name: 'onSelected', inputExample: { id: 1 } }] })
  })
  it('prevents deleting capabilities still used by events', async () => {
    const definition = createBlankDocument()
    const instance = createInstance(definition)
    instance.document.source =
      'root = Button({"id":"root","child":"label","events":{"click":{"actions":[{"type":"api","name":"searchArticles"}]}}}, [label])\nlabel = Text({"id":"label","text":"查询"}, [])'
    instance.document.integrations = {
      apis: [{ name: 'searchArticles', label: '查询文章', url: '/items', method: 'GET' }],
      callbacks: [],
    }
    manager(instance)
    await wrapper!.get('.lu-integration-item').trigger('click')
    await click('删除配置')
    expect(wrapper!.text()).toContain('正在被组件事件使用')
    expect(wrapper!.emitted('update')).toBeUndefined()
  })
})
describe('collection binding editor', () => {
  it('saves a mapping, shows its resolved preview and prevents invalid pointer writes', async () => {
    const node: ComponentNode = {
      id: 'chart',
      component: 'LingUI.BarChart',
      label: '次数',
      data: [],
    }
    wrapper = mount(DataBindingEditor, {
      props: { node, state: { items: [{ name: '示例', count: 4 }] } },
    })
    await wrapper.get('input[aria-label="data 数据路径"]').setValue('/items')
    await wrapper.get('textarea').setValue('{"label":"/name","value":"/count"}')
    await click('应用数据绑定')
    const saved = wrapper.emitted('update')![0]![0] as ComponentNode
    await wrapper.setProps({ node: saved })
    expect(wrapper.text()).toContain('示例')
    await wrapper.get('input[aria-label="data 数据路径"]').setValue('/constructor')
    await click('应用数据绑定')
    expect(wrapper.emitted('update')).toHaveLength(1)
    expect(wrapper.text()).toContain('不安全')
  })
})
describe('marketplace mapping dialog', () => {
  it('preserves dependencies by default and can map them before import', async () => {
    const instance = createInstance(createBlankDocument())
    instance.document.source =
      'root = Button({"id":"root","child":"label","events":{"click":{"actions":[{"type":"api","name":"search"}]}}}, [label])\nlabel = Text({"id":"label","text":"查询"}, [])'
    instance.document.integrations = {
      apis: [{ name: 'search', label: '查询', method: 'GET', url: '/original' }],
      callbacks: [],
    }
    wrapper = mount(DependencyMappingDialog, {
      props: {
        instance,
        targets: {
          apis: [{ name: 'local', label: '本地查询', url: '/local', method: 'GET' }],
          callbacks: [],
        },
      },
      global: { stubs: { StudioModal: stub } },
    })
    await wrapper.get('select').setValue('local')
    await click('应用并进入工作台')
    const mapped = wrapper.emitted('use')![0]![0] as ComponentInstance
    expect(mapped.document.integrations?.apis[0]!.url).toBe('/local')
    expect(instance.document.integrations.apis[0]!.url).toBe('/original')
    expect(resolveDocument(mapped.document).nodes.root!.events?.click?.actions[0]).toMatchObject({
      type: 'api',
      name: 'search',
    })
  })
})
