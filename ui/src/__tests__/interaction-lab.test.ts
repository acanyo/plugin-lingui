import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, pureTheme, type ComponentNode } from '@lingui/renderer'
import {
  column,
  document as definition,
  text,
} from '../../../packages/renderer/src/examples/builders'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}
async function render() {
  const nodes: ComponentNode[] = [
    column('root', ['load', 'list']),
    {
      id: 'load',
      component: 'Button',
      child: 'label',
      events: {
        click: {
          loadingPath: '/loading',
          errorPath: '/error',
          actions: [{ type: 'api', name: 'load', resultPath: '/response' }],
        },
      },
    },
    text('label', '加载数据'),
    {
      id: 'list',
      component: 'LingUI.KeyValue',
      entries: [],
      bindings: { entries: { path: '/response/items' } },
      dataState: {
        loading: { path: '/loading' },
        error: { path: '/error' },
        emptyText: '没有数据',
      },
    },
  ]
  const instance = createInstance(
    definition('API 作品', nodes, { loading: false, error: '', response: null }),
  )
  instance.document.integrations = {
    apis: [
      {
        name: 'load',
        label: '加载数据',
        url: 'https://example.com/data',
        method: 'GET',
        responseExample: { items: [{ label: '温度', value: '21°C' }] },
      },
    ],
    callbacks: [],
  }
  view = mount(CreationWorkspace, {
    props: { instance, themes: [pureTheme], dirty: false, busy: false, conflicted: false },
    global: { provide: { [repositoryKey as symbol]: createLocalRepository() } },
    attachTo: document.body,
  })
  await settle()
  return { view, instance }
}
async function press(label: string) {
  await view!
    .findAll('button')
    .find((button) => button.text() === label)!
    .trigger('click')
  await settle()
}
const root = () => view!.get('.lu-artifact-canvas .lingui-renderer-host').element.shadowRoot!
describe('workbench interaction lab', () => {
  it('switches success, empty and failure fixtures in the actual preview and restores the original API', async () => {
    const real = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"items":[{"label":"真实","value":"响应"}]}'))
    const { view, instance } = await render(),
      before = JSON.stringify(instance)
    for (const mode of ['success', 'empty', 'failure']) {
      await view.get('[aria-label="响应场景"]').setValue(mode)
      await press('应用场景并重置预览')
      root().querySelector<HTMLButtonElement>('button')!.click()
      await settle()
      expect(root().textContent).toContain(
        mode === 'success' ? '21°C' : mode === 'empty' ? '没有数据' : 'HTTP 503',
      )
    }
    expect(real).not.toHaveBeenCalled()
    expect(view.get('.lu-api-scenarios').text()).toContain('1 个接口正在模拟')
    await press('全部恢复原始接口')
    root().querySelector<HTMLButtonElement>('button')!.click()
    await settle()
    expect(real).toHaveBeenCalledOnce()
    expect(root().textContent).toContain('真实')
    expect(JSON.stringify(instance)).toBe(before)
    expect(view.emitted('update')).toBeUndefined()
  })
  it('uses custom fixtures for self-check, invalidates old reports and explains AI availability', async () => {
    const { view, instance } = await render()
    await view.get('[aria-label="响应场景"]').setValue('success')
    await view.get('[aria-label="成功响应 JSON"]').setValue('{"items":[{"bad":"field"}]}')
    await press('应用场景并重置预览')
    await press('运行交互自检')
    expect(view.get('.lu-interaction-check').text()).toContain('3 项失败')
    expect(view.get('.lu-interaction-check').text()).toContain('失败后重试')
    expect(view.get('.lu-interaction-check').text()).toContain('需要在 Halo 工作台')
    const repair = view.findAll('button').find((button) => button.text() === '交给 AI 修复')!
    expect((repair.element as HTMLButtonElement).disabled).toBe(true)
    await view.setProps({
      instance: { ...instance, document: { ...instance.document, title: '新标题' } },
    })
    expect(view.get('.lu-interaction-check').text()).toContain('结果已过期')
    expect(view.get('.lu-interaction-check').text()).toContain('请重新自检')
  })
})
