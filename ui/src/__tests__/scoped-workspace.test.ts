import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import {
  createInstance,
  parseSource,
  serializeSource,
  type ComponentInstance,
  type LinguiDocument,
} from '@lingui/renderer'
import { repositoryKey } from '../services/repository'
import { createHaloRepository } from '../services/halo-repository'
import StudioView from '../views/StudioView.vue'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'
import ComponentStudio from '../component-studio/ComponentStudio.vue'
import AiComposer from '../ai-adapter/AiComposer.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import EditProposalReview from '../scoped-edit/EditProposalReview.vue'
import { updateNode } from '../component-studio/document-editor'
import { contractDocument } from './fixtures/response-contract'
import { resumeSnapshot } from '../creation-history/types'
import type { ConversationState } from '../ai-adapter/conversation'

let view: VueWrapper | undefined
const permissions = utils.permission.getUserPermissions()
afterEach(() => {
  view?.unmount()
  view = undefined
  utils.permission.setUserPermissions(permissions ?? [])
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
function initial() {
  const document = contractDocument(),
    nodes = parseSource(document.source).filter((node) => node.id !== 'list')
  nodes[0]!.children = ['load', 'metric']
  return createInstance({ ...document, source: serializeSource(nodes) })
}
function edit(document: LinguiDocument, id: string, patch: Record<string, unknown>) {
  return updateNode(document, {
    ...parseSource(document.source).find((node) => node.id === id)!,
    ...patch,
  })
}
const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}
async function setup(instance = initial()) {
  const repository = createHaloRepository()
  repository.getGenerationSettings = undefined
  vi.spyOn(repository, 'listTemplates').mockResolvedValue([])
  vi.spyOn(repository, 'listThemes').mockResolvedValue([])
  const generate = vi.spyOn(repository, 'generate'),
    save = vi.spyOn(repository, 'saveTemplate')
  utils.permission.setUserPermissions(['*'])
  view = mount(StudioView, {
    attachTo: document.body,
    props: { initialInstance: instance },
    global: {
      provide: { [repositoryKey as symbol]: repository },
      plugins: [[formkit, defaultConfig()]],
      stubs: { transition: false },
    },
  })
  await settle()
  return { instance, generate, save }
}
async function press(text: string) {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === text,
  )
  expect(button, `button ${text}`).toBeTruthy()
  button!.click()
  await settle()
}
async function select(id = 'load') {
  await press('选取修改')
  const root = view!.get('.lu-artifact-canvas .lingui-renderer-host').element.shadowRoot!
  root.querySelector<HTMLElement>(`[data-lingui-node="${id}"]`)!.click()
  await settle()
}
async function send(text = '把按钮文字改为查询天气') {
  await view!.get('textarea[aria-label="组件创作需求"]').setValue(text)
  await view!.get('.lu-prompt-box').trigger('submit')
  await settle()
}
function current() {
  return view!.findComponent(CreationWorkspace).props('instance') as ComponentInstance
}
const label = () => parseSource(current().document.source).find((node) => node.id === 'label')!.text

describe('scoped edit workbench workflow', () => {
  it('selects hidden components by ID and leaves selection with Escape from the toolbar', async () => {
    await setup()
    await press('选取修改')
    await view!.get('[aria-label="选取局部修改组件"] select').setValue('metric')
    await settle()
    expect(view!.get('[aria-label="AI 局部修改目标"]').text()).toContain('metric')
    await press('重新选取')
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    view!.get('.lu-artifact-actions button').element.dispatchEvent(escape)
    await settle()
    expect(escape.defaultPrevented).toBe(true)
    expect(view!.find('[aria-label="选取局部修改组件"]').exists()).toBe(false)
  })
  it('returns from fullscreen to the composer after choosing a component', async () => {
    const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
    const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false
        this.dispatchEvent(new Event('close'))
      },
    })
    try {
      await setup()
      await view!.get('[aria-label="全屏预览"]').trigger('click')
      await settle()
      const dialog = document.body.querySelector<HTMLDialogElement>('dialog.lu-fullscreen-preview')!
      expect(dialog.open).toBe(true)
      await press('选取修改')
      dialog
        .querySelector<HTMLElement>('.lingui-renderer-host')!
        .shadowRoot!.querySelector<HTMLElement>('[data-lingui-node="label"]')!
        .click()
      await settle()
      expect(dialog.open).toBe(false)
      expect(document.body.style.overflow).not.toBe('hidden')
      expect(document.activeElement?.getAttribute('aria-label')).toBe('组件创作需求')
      expect(view!.get('[aria-label="AI 局部修改目标"]').text()).toContain('label')
    } finally {
      view?.unmount()
      view = undefined
      if (show) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', show)
      else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
      if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close)
      else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
    }
  })
  it('intercepts selection clicks and focus before API handlers, keeps the same preview, then restores normal interaction', async () => {
    const request = vi.fn(async () => new Response('{"temperature":23,"items":[]}'))
    vi.stubGlobal('fetch', request)
    const { instance } = await setup()
    const original = JSON.stringify(instance)
    const host = view!.get('.lu-artifact-canvas .lingui-renderer-host').element
    const shadow = host.shadowRoot!
    await select()
    expect(request).not.toHaveBeenCalled()
    expect(view!.get('[aria-label="AI 局部修改目标"]').text()).toContain('load')
    expect(view!.get('.lu-creation-grid').attributes('data-panel')).toBe('chat')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('组件创作需求')
    expect(view!.get('.lu-artifact-canvas .lingui-renderer-host').element).toBe(host)
    expect(JSON.stringify(current())).toBe(original)
    shadow.querySelector<HTMLButtonElement>('button')!.click()
    await settle()
    expect(request).toHaveBeenCalledTimes(1)
    expect(shadow.querySelector('.lg-error')).toBeNull()
    await press('重新选取')
    shadow
      .querySelector<HTMLButtonElement>('button')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))
    await settle()
    expect(view!.find('[aria-label="选取局部修改组件"]').exists()).toBe(false)
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('selects an ancestor/subtree, reviews isolated previews, adopts only on confirmation, and supports undo/redo without saving', async () => {
    const { instance, generate, save } = await setup()
    const generatedDoc = edit(instance.document, 'label', { text: '查询天气' })
    generate.mockResolvedValue(generatedDoc)
    await select('label')
    const card = view!.get('[aria-label="AI 局部修改目标"]')
    await card
      .findAll('button')
      .find((button) => button.text() === 'load')!
      .trigger('click')
    await press('包含子组件')
    await send()
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0]![0]).toContain('"scope":"subtree"')
    expect(label()).toBe('加载天气')
    await press('比较并采用修改')
    const review = view!.findComponent(EditProposalReview)
    expect(document.body.textContent).toContain('当前作品')
    expect(document.body.textContent).toContain('采用勾选项后')
    for (const renderer of review.findAllComponents(LinguiRenderer)) {
      expect(
        renderer.props('interactions')?.requests?.allow(new URL('https://api.example.com'), 'GET'),
      ).toBe(false)
      expect(renderer.props('interactions')?.inheritRegistered).toBe(false)
    }
    await press('采用 1 项修改')
    expect(label()).toBe('查询天气')
    expect(view!.get('.lu-conversation').text()).toContain('已采用')
    expect(current().document.integrations).toEqual(instance.document.integrations)
    expect(current().theme).toEqual(instance.theme)
    await view!.get('[aria-label="撤销修改"]').trigger('click')
    await settle()
    expect(label()).toBe('加载天气')
    await view!.get('[aria-label="重做修改"]').trigger('click')
    await settle()
    expect(label()).toBe('查询天气')
    expect(save).not.toHaveBeenCalled()
  })
  it('preserves manual edits made while generating and defaults same-property conflicts to the user value', async () => {
    const { instance, generate } = await setup()
    let resolve!: (document: LinguiDocument) => void
    generate.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    await select('label')
    await send('按钮文字简短一点')
    await press('手动编辑')
    const manual = edit(edit(instance.document, 'metric', { label: '我的温度' }), 'label', {
      text: '我手动写的',
    })
    view!.findComponent(ComponentStudio).vm.$emit('update', { ...instance, document: manual })
    await settle()
    resolve(edit(instance.document, 'label', { text: '查询天气' }))
    await settle()
    expect(label()).toBe('我手动写的')
    await press('比较并采用修改')
    const review = view!.findComponent(EditProposalReview)
    expect(review.text()).toContain('存在冲突 · 保留当前值')
    expect(
      [...document.body.querySelectorAll('button')].find(
        (button) => button.textContent === '采用 0 项修改',
      )?.disabled,
    ).toBe(true)
    await review.get('input[type="checkbox"]').setValue(true)
    await settle()
    await press('采用 1 项修改')
    expect(label()).toBe('查询天气')
    expect(parseSource(current().document.source).find((node) => node.id === 'metric')!.label).toBe(
      '我的温度',
    )
    expect(view!.find('.lu-ai-conflict').exists()).toBe(false)
  })
  it('discards a proposal without changing the work and preserves its decision in conversation history', async () => {
    const { instance, generate } = await setup()
    generate.mockResolvedValue(edit(instance.document, 'label', { text: 'AI 的文字' }))
    await select('label')
    await send()
    await press('比较并采用修改')
    await press('放弃这次修改')
    expect(label()).toBe('加载天气')
    expect(view!.get('.lu-conversation').text()).toContain('已放弃')
    const state = view!.findComponent(AiComposer).emitted('conversation')!.at(-1)![0] as {
      messages: Array<{ editProposal?: { state: string } }>
    }
    expect(state.messages.at(-1)!.editProposal?.state).toBe('discarded')
  })
  it('blocks out-of-scope results and failed-draft bypass, and retries the original target even after selection is cleared', async () => {
    const { instance, generate } = await setup()
    generate.mockResolvedValue(edit(instance.document, 'metric', { label: 'AI 修改了别处' }))
    await select('label')
    await send()
    expect(generate).toHaveBeenCalledTimes(3)
    expect(view!.get('.lu-conversation').text()).toContain('修改超出所选范围')
    expect(view!.find('.lu-chat-proposal').exists()).toBe(false)
    expect(view!.findAll('button').some((button) => button.text() === '查看待修复草稿')).toBe(false)
    expect(label()).toBe('加载天气')
    await press('改为整件作品')
    generate.mockResolvedValue(edit(instance.document, 'label', { text: '查询天气' }))
    await press('重试生成')
    expect(generate.mock.calls.at(-1)![0]).toContain('"nodeId":"label"')
    expect(label()).toBe('加载天气')
    expect(view!.find('.lu-chat-proposal').exists()).toBe(true)
  })
  it('does not create a proposal or apply a late scoped result after cancellation', async () => {
    const { instance, generate } = await setup()
    let resolve!: (document: LinguiDocument) => void
    generate.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    await select('label')
    await send()
    await view!.get('[aria-label="停止生成"]').trigger('click')
    resolve(edit(instance.document, 'label', { text: '迟到结果' }))
    await settle()
    expect(label()).toBe('加载天气')
    expect(view!.find('.lu-chat-proposal').exists()).toBe(false)
    expect(view!.get('.lu-conversation').text()).toContain('已停止生成')
  })
  it('restores an unreviewed proposal without applying it and preserves instance parameter values', async () => {
    const value = initial()
    value.document.parameters = [
      { key: 'city', label: '城市', type: 'string', path: '/city', default: '北京' },
    ]
    value.parameters = { city: '上海' }
    const { instance, generate } = await setup(value)
    generate.mockResolvedValue(edit(instance.document, 'label', { text: '查询天气' }))
    await select('label')
    await send()
    expect(generate.mock.calls[0]![1]!.parameters[0]!.default).toBe('北京')
    const state = view!
      .findComponent(AiComposer)
      .emitted('conversation')!
      .at(-1)![0] as ConversationState
    const restored = resumeSnapshot({
      instance: current(),
      messages: state.messages,
      instruction: state.instruction,
      dirty: false,
      editing: false,
    })
    view!.unmount()
    document.body.replaceChildren()
    const repository = createHaloRepository()
    view = mount(AiComposer, {
      attachTo: document.body,
      props: {
        instance: restored.instance,
        initialConversation: { messages: restored.messages, instruction: restored.instruction },
      },
      global: {
        provide: { [repositoryKey as symbol]: repository },
        plugins: [[formkit, defaultConfig()]],
      },
    })
    await settle()
    expect(view.emitted('generated')).toBeUndefined()
    await press('比较并采用修改')
    await press('采用 1 项修改')
    const source = view.emitted('generated')!.at(-1)![1] as ComponentInstance
    expect(source.parameters.city).toBe('上海')
    expect(source.document.parameters[0]!.default).toBe('北京')
  })
  it('invalidates a proposal after its target was removed and offers discard without resurrecting it', async () => {
    const { instance, generate } = await setup()
    generate.mockResolvedValue(edit(instance.document, 'label', { text: '查询天气' }))
    await select('label')
    await send()
    await press('手动编辑')
    const nodes = parseSource(instance.document.source).filter(
      (node) => !['load', 'label'].includes(node.id),
    )
    nodes[0]!.children = ['metric']
    view!
      .findComponent(ComponentStudio)
      .vm.$emit('update', {
        ...instance,
        document: { ...instance.document, source: serializeSource(nodes) },
      })
    await settle()
    expect(view!.find('[aria-label="AI 局部修改目标"]').exists()).toBe(false)
    await press('比较并采用修改')
    expect(document.body.textContent).toContain('目标已失效')
    await press('放弃这次修改')
    expect(parseSource(current().document.source).some((node) => node.id === 'label')).toBe(false)
  })
})
