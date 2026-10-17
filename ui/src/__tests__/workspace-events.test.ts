import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, pureTheme } from '@lingui/renderer'
import { document as definition, text } from '../../../packages/renderer/src/examples/builders'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'
import ComponentStudio from '../component-studio/ComponentStudio.vue'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import { contractDocument } from './fixtures/response-contract'
import { parseSource, type ComponentInstance } from '@lingui/renderer'
import IntegrationManager from '../integrations/IntegrationManager.vue'
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}
function render(method: 'GET' | 'POST' = 'GET') {
  const instance = createInstance(
    definition(
      '事件作品',
      [
        {
          id: 'root',
          component: 'Button',
          child: 'label',
          events: {
            click: {
              actions: [
                { type: 'request', url: 'https://api.example.com/save', method },
                { type: 'callback', name: 'lingui.log', args: { $result: '/' } },
              ],
            },
          },
        },
        text('label', '执行'),
      ],
      {},
    ),
  )
  wrapper = mount(CreationWorkspace, {
    props: {
      instance,
      themes: [pureTheme],
      dirty: false,
      busy: false,
      conflicted: false,
      initialEditing: true,
    },
    global: { provide: { [repositoryKey as symbol]: createLocalRepository() } },
    attachTo: document.body,
  })
  return wrapper
}
describe('workbench preview event debugging', () => {
  it('requires a Halo project for embedding without changing the local work', async () => {
    const view = render()
    await settle()
    const instance = (view.props() as { instance: ComponentInstance }).instance
    const original = JSON.stringify(instance)
    const menu = view.get('.lu-workspace-more').element as HTMLDetailsElement
    menu.open = true
    await view
      .findAll('.lu-workspace-menu button')
      .find((button) => button.text() === '复制嵌入代码')!
      .trigger('click')
    await settle()
    expect(menu.open).toBe(false)
    expect(document.body.textContent).toContain('请先在 Halo 中将作品保存为项目')
    expect(document.querySelector('[aria-label="组件嵌入代码"]')).toBeNull()
    expect(JSON.stringify(instance)).toBe(original)
    expect(view.emitted('update')).toBeUndefined()
    expect(view.emitted('save')).toBeUndefined()
  })

  it('compares actual preview results and navigates to an editable component binding without changing the project', async () => {
    const original = contractDocument(),
      before = JSON.stringify(original)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"temperature":"21","items":[]}')),
    )
    wrapper = mount(CreationWorkspace, {
      props: {
        instance: createInstance(original),
        themes: [pureTheme],
        dirty: false,
        busy: false,
        conflicted: false,
      },
      global: { provide: { [repositoryKey as symbol]: createLocalRepository() } },
      attachTo: document.body,
    })
    await settle()
    wrapper
      .get('.lu-artifact-canvas .lingui-renderer-host')
      .element.shadowRoot!.querySelector<HTMLButtonElement>('button')!
      .click()
    await settle()
    const panel = wrapper.get('[aria-label="接口字段变化"]')
    expect(panel.text()).toContain('类型变化 · 数字 → 字符串')
    expect(panel.text()).toContain('/temperature')
    await panel.get('[aria-label="定位组件 metric 的 value"]').trigger('click')
    await settle()
    expect(wrapper.get('.lu-manual-editor').isVisible()).toBe(true)
    expect(wrapper.get('.lu-inspector-node').text()).toContain('metric')
    const input = wrapper.get<HTMLInputElement>('[aria-label="value 绑定路径"]')
    expect(input.element.value).toBe('/response/temperature')
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.emitted('update')).toBeUndefined()
    await input.setValue('/response/currentTemperature')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '应用属性绑定')!
      .trigger('click')
    const updated = wrapper.emitted('update')!.at(-1)![0] as ComponentInstance
    expect(
      parseSource(updated.document.source).find((node) => node.id === 'metric')!.value,
    ).toEqual({ path: '/response/currentTemperature' })
    expect(JSON.stringify(original)).toBe(before)
  })
  it('closes the API manager when locating a changed field and opens the matching inspector', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"items":[]}')),
    )
    wrapper = mount(CreationWorkspace, {
      props: {
        instance: createInstance(contractDocument()),
        themes: [pureTheme],
        dirty: false,
        busy: false,
        conflicted: false,
      },
      global: {
        provide: { [repositoryKey as symbol]: createLocalRepository() },
        stubs: { StudioModal: { template: '<section><slot/><slot name="footer"/></section>' } },
      },
      attachTo: document.body,
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '接口与回调')!
      .trigger('click')
    const manager = wrapper.findComponent(IntegrationManager)
    await manager.get('.lu-integration-item').trigger('click')
    await manager
      .findAll('button')
      .find((button) => button.text() === '用参数示例测试')!
      .trigger('click')
    await settle()
    await manager.get('[aria-label="定位组件 metric 的 value"]').trigger('click')
    await settle()
    expect(wrapper.findComponent(IntegrationManager).exists()).toBe(false)
    expect(wrapper.get('.lu-inspector-node').text()).toContain('metric')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('value 绑定路径')
  })
  it.each(['GET', 'POST'] as const)(
    'executes %s from the main preview without an enable switch and shares reports with the editor',
    async (method) => {
      const request = vi.fn(async () => new Response('{"saved":true}', { status: 200 }))
      vi.stubGlobal('fetch', request)
      const view = render(method)
      await settle()
      const studio = view.findComponent(ComponentStudio)
      await studio
        .findAll('button')
        .find((button) => button.text().trim() === '交互')!
        .trigger('click')
      const preview = view.get('.lu-artifact-canvas .lingui-renderer-host').element.shadowRoot!
      preview.querySelector<HTMLButtonElement>('button')!.click()
      await settle()
      expect(request).toHaveBeenCalledTimes(1)
      expect(request).toHaveBeenCalledWith(
        'https://api.example.com/save',
        expect.objectContaining({ method, credentials: 'omit' }),
      )
      expect(studio.find('.lu-event-debug-settings input').exists()).toBe(false)
      expect(studio.get('.lu-event-debugger').text()).toContain('已完成')
      expect(preview.querySelector('.lg-error')).toBeNull()
    },
  )
  it('shows HTTP error details and allows retrying the same preview button', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"detail":"天气服务暂时不可用"}', { status: 502 }))
      .mockResolvedValueOnce(new Response('{"temperature":21}', { status: 200 }))
    vi.stubGlobal('fetch', request)
    const view = render()
    await settle()
    const studio = view.findComponent(ComponentStudio)
    await studio
      .findAll('button')
      .find((button) => button.text().trim() === '交互')!
      .trigger('click')
    const preview = view.get('.lu-artifact-canvas .lingui-renderer-host').element.shadowRoot!
    preview.querySelector<HTMLButtonElement>('button')!.click()
    await settle()
    expect(studio.get('.lu-event-debugger').text()).toContain('HTTP 502')
    expect(studio.get('.lu-event-debugger').text()).toContain('天气服务暂时不可用')
    preview.querySelector<HTMLButtonElement>('button')!.click()
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
    expect(studio.get('.lu-event-debugger').text()).toContain('已完成')
    expect(preview.querySelector('.lg-error')).toBeNull()
  })
})
