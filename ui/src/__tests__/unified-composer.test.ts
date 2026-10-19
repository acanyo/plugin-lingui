import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import {
  createInstance,
  pureTheme,
  type ComponentInstance,
  type LinguiDocument,
} from '@lingui/renderer'
import { column, document as design, text } from '../../../packages/renderer/src/examples/builders'
import AiComposer from '../ai-adapter/AiComposer.vue'
import type { ConversationState } from '../ai-adapter/conversation'
import type { StudioRepository } from '../component-library/types'
import type { CandidateSet } from '../design-candidates/model'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'

let view: VueWrapper | undefined
const permissions = utils.permission.getUserPermissions()
const card = (title: string) => design(title, [column('root', ['label']), text('label', title)])
const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}
afterEach(() => {
  view?.unmount()
  view = undefined
  utils.permission.setUserPermissions(permissions ?? [])
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function repository() {
  utils.permission.setUserPermissions(['*'])
  const generate = vi.fn<StudioRepository['generate']>().mockResolvedValue(card('单方案结果'))
  return { ...createLocalRepository(), mode: 'halo' as const, generate }
}
async function workspace(
  props: { instance?: ComponentInstance; initialConversation?: ConversationState } = {},
) {
  const api = repository()
  view = mount(CreationWorkspace, {
    attachTo: document.body,
    props: { themes: [pureTheme], dirty: false, busy: false, conflicted: false, ...props },
    global: { provide: { [repositoryKey as symbol]: api } },
  })
  await settle()
  return api
}
async function composer(
  props: {
    instance?: ComponentInstance
    initialConversation?: ConversationState
    editTarget?: { nodeId: string; scope: 'node' | 'subtree' }
  } = {},
) {
  const api = repository()
  view = mount(AiComposer, {
    attachTo: document.body,
    props: { canGenerateMultiple: true, ...props },
    global: { provide: { [repositoryKey as symbol]: api } },
  })
  await settle()
  return api
}
function button(label: string) {
  const found = view!
    .findAll<HTMLButtonElement>('button')
    .find((item) => item.text().trim() === label)
  expect(found, `button ${label}`).toBeTruthy()
  return found!
}
const prompt = () => view!.get<HTMLTextAreaElement>('textarea[aria-label="组件创作需求"]')
async function mode(label: '单方案' | '多方案') {
  await button(label).trigger('click')
  await settle()
}
async function send(text: string, enter = false) {
  await prompt().setValue(text)
  if (enter) await prompt().trigger('keydown', { key: 'Enter' })
  else await view!.get('.lu-prompt-box').trigger('submit')
  await settle()
}
function candidates() {
  return view!.emitted('candidates')!.at(-1)![0] as CandidateSet
}

describe('one workbench requirement composer', () => {
  it('keeps one visible requirement textbox and the same draft when switching generation mode', async () => {
    const api = await workspace()
    expect(view!.findAll('textarea').filter((input) => input.isVisible())).toHaveLength(1)
    expect(view!.find('textarea[aria-label="多方案共同需求"]').exists()).toBe(false)
    expect(button('单方案').attributes('aria-pressed')).toBe('true')
    const draft = '保留这段尚未发送的需求\n并尝试两种布局'
    await prompt().setValue(draft)
    await mode('多方案')
    expect(prompt().element.value).toBe(draft)
    expect(button('多方案').attributes('aria-pressed')).toBe('true')
    await mode('单方案')
    expect(prompt().element.value).toBe(draft)
    expect(api.generate).not.toHaveBeenCalled()
    expect(view!.emitted('conversation')!.at(-1)![0]).toMatchObject({
      instruction: draft,
      generationMode: 'single',
    })
  })

  it.each(['Enter', 'send button'])(
    'runs two candidates sequentially through %s without adopting either',
    async (trigger) => {
      const instance = createInstance(card('当前作品'))
      const api = await workspace({ instance })
      const first = deferred<LinguiDocument>()
      api.generate.mockReturnValueOnce(first.promise).mockResolvedValueOnce(card('第二方案'))
      await mode('多方案')
      await prompt().setValue('为当前作品比较两个排版方案')
      if (trigger === 'Enter') await prompt().trigger('keydown', { key: 'Enter' })
      else {
        expect(view!.get('button[type="submit"]').attributes('aria-label')).toBe('生成两种方案')
        await view!.get('button[aria-label="生成两种方案"]').trigger('click')
      }
      await settle()
      expect(api.generate).toHaveBeenCalledTimes(1)
      expect(candidates().candidates.map((item) => item.status)).toEqual(['running', 'queued'])
      expect(button('单方案').element.disabled).toBe(true)
      expect(button('多方案').element.disabled).toBe(true)
      expect(view!.get<HTMLButtonElement>('button[aria-label="导入 JSON"]').element.disabled).toBe(
        true,
      )
      expect(
        view!.get<HTMLButtonElement>('button[aria-label="连接外部 AI"]').element.disabled,
      ).toBe(true)
      first.resolve(card('第一方案'))
      await settle()
      expect(api.generate).toHaveBeenCalledTimes(2)
      expect(candidates().candidates.map((item) => item.status)).toEqual(['done', 'done'])
      expect(candidates().candidates.map((item) => item.instance?.document.title)).toEqual([
        '第一方案',
        '第二方案',
      ])
      expect(api.generate.mock.calls[0]![1]).toEqual(instance.document)
      expect(api.generate.mock.calls[1]![1]).toEqual(instance.document)
      expect((view!.props() as { instance: ComponentInstance }).instance.document.title).toBe('当前作品')
      expect(view!.emitted('generated')).toBeUndefined()
    },
  )

  it('stops the active and queued candidates from the main composer and ignores a late result', async () => {
    const api = await workspace()
    const late = deferred<LinguiDocument>()
    api.generate.mockReturnValueOnce(late.promise)
    await mode('多方案')
    await send('生成两个信息卡布局', true)
    const signal = api.generate.mock.calls[0]![2]!.signal!
    expect(signal.aborted).toBe(false)
    const stop = view!.get<HTMLButtonElement>('button[aria-label="停止生成"]')
    expect(stop.element.disabled).toBe(false)
    await stop.trigger('click')
    await settle()
    expect(signal.aborted).toBe(true)
    expect(candidates().candidates.map((item) => item.status)).toEqual(['stopped', 'stopped'])
    late.resolve(card('取消后迟到的方案'))
    await settle()
    expect(api.generate).toHaveBeenCalledTimes(1)
    expect(
      candidates().candidates.every((item) => !item.instance && item.status === 'stopped'),
    ).toBe(true)
    expect(view!.emitted('generated')).toBeUndefined()
    expect(view!.find('button[aria-label="停止生成"]').exists()).toBe(false)
    expect(button('单方案').element.disabled).toBe(false)
  })

  it('explicitly blocks long multi-candidate prompts without losing text and still supports a single result', async () => {
    const api = await workspace()
    const draft = '长'.repeat(3401)
    await prompt().setValue(draft)
    await mode('多方案')
    expect(prompt().element.value).toBe(draft)
    expect(prompt().attributes('maxlength')).toBe('4000')
    expect(view!.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(true)
    expect(view!.text()).toContain('3400')
    await view!.get('.lu-prompt-box').trigger('submit')
    await prompt().trigger('keydown', { key: 'Enter' })
    await settle()
    expect(api.generate).not.toHaveBeenCalled()
    expect(prompt().element.value).toBe(draft)
    await mode('单方案')
    await view!.get('.lu-prompt-box').trigger('submit')
    await settle()
    expect(api.generate).toHaveBeenCalledTimes(1)
    expect(api.generate.mock.calls[0]![0]).toBe(draft)
    expect(view!.emitted('generated')![0]![0]).toMatchObject({ title: '单方案结果' })
    expect(view!.emitted('candidates')).toBeUndefined()
  })

  it('keeps scoped editing on the single-result path after restoring multi-candidate mode', async () => {
    const instance = createInstance(card('当前作品'))
    const api = await composer({
      instance,
      initialConversation: {
        messages: [],
        instruction: '把文字简短一点',
        generationMode: 'multiple',
      },
      editTarget: { nodeId: 'label', scope: 'node' },
    })
    api.generate.mockResolvedValue(card('当前作品'))
    expect(button('多方案').element.disabled).toBe(true)
    expect(button('单方案').attributes('aria-pressed')).toBe('true')
    await prompt().trigger('keydown', { key: 'Enter' })
    await settle()
    expect(api.generate).toHaveBeenCalledTimes(1)
    expect(api.generate.mock.calls[0]![0]).toContain('label')
    expect(view!.emitted('multiple')).toBeUndefined()
    expect(view!.text()).toContain('局部修改')
  })

  it('keeps interaction repairs and message retry single while leaving the multi-candidate draft intact', async () => {
    const draft = '接下来比较两种布局'
    const api = await composer({
      instance: createInstance(card('当前作品')),
      initialConversation: {
        generationMode: 'multiple',
        instruction: draft,
        messages: [
          {
            id: 1,
            role: 'assistant',
            text: '暂时失败',
            status: 'error',
            instruction: '重试之前的单方案修改',
          },
        ],
      },
    })
    await button('重试生成').trigger('click')
    await settle()
    expect(api.generate).toHaveBeenCalledTimes(1)
    expect(api.generate.mock.calls[0]![0]).toContain('重试之前的单方案修改')
    expect(view!.emitted('multiple')).toBeUndefined()
    await (view!.vm as unknown as { repair: (instruction: string) => Promise<void> }).repair(
      '修复按钮点击交互',
    )
    await settle()
    expect(api.generate).toHaveBeenCalledTimes(2)
    expect(api.generate.mock.calls[1]![0]).toContain('修复按钮点击交互')
    expect(view!.emitted('multiple')).toBeUndefined()
    expect(prompt().element.value).toBe(draft)
    expect(button('多方案').attributes('aria-pressed')).toBe('true')
  })
})
