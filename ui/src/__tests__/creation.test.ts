import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { Dialog } from '@halo-dev/components'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import {
  CATALOG_ID,
  componentNames,
  createInstance,
  examples,
  resolveDocument,
  pureTheme,
  serializeSource,
  type ComponentNode,
  type ComponentInstance,
  type LinguiDocument,
} from '@lingui/renderer'
import StudioView from '../views/StudioView.vue'
import ComponentStudio from '../component-studio/ComponentStudio.vue'
import SaveTemplateDialog from '../component-library/SaveTemplateDialog.vue'
import type { TemplateRecord } from '../component-library/types'
import IntegrationManager from '../integrations/IntegrationManager.vue'
import { createHaloRepository } from '../services/halo-repository'
import { repositoryKey } from '../services/repository'
import { conversationInstruction, type ConversationMessage } from '../ai-adapter/conversation'
import { GenerationOutputError } from '../ai-adapter/output-error'

let wrapper: VueWrapper | undefined
const previousPermissions = utils.permission.getUserPermissions()
afterEach(() => {
  wrapper?.unmount()
  utils.permission.setUserPermissions(previousPermissions ?? [])
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
async function setup(instance?: ComponentInstance, templates: TemplateRecord[] = []) {
  const repository = createHaloRepository()
  repository.getGenerationSettings = undefined
  vi.spyOn(repository, 'listTemplates').mockResolvedValue(templates)
  vi.spyOn(repository, 'listThemes').mockResolvedValue([])
  const save = vi.spyOn(repository, 'saveTemplate')
  const generate = vi.spyOn(repository, 'generate')
  utils.permission.setUserPermissions(['*'])
  wrapper = mount(StudioView, {
    attachTo: document.body,
    props: { initialInstance: instance },
    global: {
      provide: { [repositoryKey as symbol]: repository },
      plugins: [[formkit, defaultConfig()]],
      stubs: { transition: false },
    },
  })
  await flushPromises()
  return { generate, save }
}
async function press(text: string) {
  await wrapper!
    .findAll('button')
    .find((button) => button.text().trim() === text)!
    .trigger('click')
  await flushPromises()
}
async function send(text: string) {
  await wrapper!.get('textarea[aria-label="组件创作需求"]').setValue(text)
  await wrapper!.get('.lu-prompt-box').trigger('submit')
  await flushPromises()
}
function title() {
  return (wrapper!.get('input[aria-label="组件名称"]').element as HTMLInputElement).value
}
function deferred() {
  let resolve!: (document: LinguiDocument) => void
  const promise = new Promise<LinguiDocument>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('AI conversation workspace', () => {
  function calculator(min: number): LinguiDocument {
    const nodes: ComponentNode[] = [
      { id: 'root', component: 'Column', children: ['divisor', 'result'] },
      {
        id: 'divisor',
        component: 'LingUI.NumberInput',
        label: '除数',
        value: { path: '/divisor' },
        min,
        max: 10,
      },
      {
        id: 'result',
        component: 'Text',
        text: {
          call: 'lingui.evaluate',
          args: { expression: { op: 'divide', args: [10, { path: '/divisor' }] } },
        },
      },
    ]
    return {
      schemaVersion: 'lingui.document/2',
      title: '新生成的计算器',
      parameters: [],
      state: { divisor: 2 },
      source: serializeSource(nodes),
    }
  }
  it('automatically repairs runtime failures using the generated design snapshot and shows the actual self-check result', async () => {
    const instance = createInstance(examples.find((example) => example.id === 'faq')!.create())
    const { generate, save } = await setup(instance)
    const theme = { ...pureTheme, id: 'user-theme', name: '用户主题', radius: 0 }
    generate
      .mockResolvedValueOnce({ document: calculator(0), theme })
      .mockResolvedValueOnce(calculator(1))
    await send('生成计算器')
    expect(generate).toHaveBeenCalledTimes(2)
    expect(generate.mock.calls[1]![0]).toContain('除数不能为零')
    expect(generate.mock.calls[1]![0].length).toBeLessThanOrEqual(4000)
    expect(generate.mock.calls[1]![1]).toEqual(calculator(0))
    expect(title()).toBe('新生成的计算器')
    expect(wrapper!.get('.lu-conversation').text()).toContain('已自动修正')
    expect(wrapper!.get('.lu-conversation').text()).toContain('交互自检')
    expect(wrapper!.get('.lu-interaction-check').text()).toContain('3 项通过')
    expect(wrapper!.get<HTMLSelectElement>('[aria-label="预览主题"]').element.value).toBe(theme.id)
    expect(save).not.toHaveBeenCalled()
  })
  it('retains the original project and an explicitly adoptable draft after two failed repairs', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    generate.mockResolvedValue(calculator(0))
    await send('生成计算器')
    expect(generate).toHaveBeenCalledTimes(3)
    expect(title()).toBe(instance.document.title)
    expect(wrapper!.get('.lu-chat-message.is-error').text()).toContain('除数不能为零')
    await press('查看待修复草稿')
    expect(document.body.textContent).toContain('此草稿尚未通过检查')
    expect(title()).toBe(instance.document.title)
    const adopt = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '采用草稿继续编辑',
    )!
    adopt.click()
    await flushPromises()
    expect(title()).toBe('新生成的计算器')
  })
  it('keeps a newly generated API in an existing work and preserves configured endpoints with the same name', async () => {
    const instance = createInstance(examples[0]!.create())
    const existing = {
      name: 'configured',
      label: '已有接口',
      method: 'GET' as const,
      url: '/existing',
    }
    instance.document.integrations = { apis: [existing], callbacks: [] }
    const { generate, save } = await setup(instance)
    const weather = {
      name: 'weather',
      label: '天气',
      method: 'GET' as const,
      url: 'https://api.example.com/weather',
    }
    generate.mockResolvedValue({
      ...instance.document,
      title: '天气作品',
      integrations: { apis: [{ ...existing, url: '/model-changed' }, weather], callbacks: [] },
      source:
        'root = Button({"id":"root","child":"label","events":{"click":{"actions":[{"type":"api","name":"weather"}]}}}, [label])\nlabel = Text({"id":"label","text":"获取天气"}, [])',
    })
    await send('基于 https://api.example.com/weather 接口添加天气展示')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(title()).toBe('天气作品')
    expect(
      wrapper!.findComponent(ComponentStudio).props('instance').document.integrations!.apis,
    ).toEqual([existing, weather])
    expect(save).not.toHaveBeenCalled()
  })

  it('opens integration settings before any work exists and closes without creating a draft', async () => {
    const { save } = await setup()
    await wrapper!.get('[aria-label="组件创作需求"]').setValue('尚未发送的需求')
    const entry = wrapper!
      .findAll('button')
      .find((button) => button.text().trim() === '接口与回调')!
    expect(entry.element.disabled).toBe(false)
    await entry.trigger('click')
    await flushPromises()
    expect(wrapper!.findComponent(IntegrationManager).exists()).toBe(true)
    expect(wrapper!.findComponent(IntegrationManager).text()).toContain('可以先配置，再让 AI 创作')
    await press('完成')
    expect(wrapper!.findComponent(IntegrationManager).exists()).toBe(false)
    expect(wrapper!.find('input[aria-label="组件名称"]').exists()).toBe(false)
    expect(wrapper!.get<HTMLTextAreaElement>('[aria-label="组件创作需求"]').element.value).toBe(
      '尚未发送的需求',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('configures APIs and callbacks from a new conversation and passes them to the first AI turn', async () => {
    const { save, generate } = await setup()
    const instruction = '用文章接口做一个列表，点击后调用选择回调'
    await wrapper!.get('[aria-label="组件创作需求"]').setValue(instruction)
    await press('接口与回调')
    await press('新增接口')
    await wrapper!.get('input[placeholder="搜索文章"]').setValue('查询文章')
    await wrapper!.get('input[placeholder="searchArticles"]').setValue('searchArticles')
    await wrapper!
      .get('input[placeholder="/business-api/articles"]')
      .setValue('/business-api/articles')
    await press('保存配置')
    await press('JS 回调')
    await press('新增回调')
    await wrapper!.get('input[placeholder="搜索文章"]').setValue('选择文章')
    await wrapper!.get('input[placeholder="searchArticles"]').setValue('onSelected')
    await press('保存配置')
    await press('完成')
    expect(wrapper!.get<HTMLTextAreaElement>('[aria-label="组件创作需求"]').element.value).toBe(
      instruction,
    )
    const configured = wrapper!.findComponent(ComponentStudio).props('instance')
      .document.integrations
    expect(configured).toMatchObject({
      apis: [{ name: 'searchArticles', url: '/business-api/articles' }],
      callbacks: [{ name: 'onSelected' }],
    })
    await press('接口与回调')
    expect(wrapper!.findComponent(IntegrationManager).findAll('.lu-integration-item')).toHaveLength(
      1,
    )
    await press('完成')
    generate.mockResolvedValue(examples[0]!.create())
    await wrapper!.get('.lu-prompt-box').trigger('submit')
    await flushPromises()
    expect(generate.mock.calls[0]![1]!.integrations).toEqual(configured)
    expect(wrapper!.findComponent(ComponentStudio).props('instance').document.integrations).toEqual(
      configured,
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('also repairs designs rejected by the repository response parser', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    generate
      .mockRejectedValueOnce(new GenerationOutputError(new Error('OpenUI 返回结构无效')))
      .mockResolvedValueOnce({ ...instance.document, title: '解析修复成功' })
    await send('调整组件')
    expect(generate).toHaveBeenCalledTimes(2)
    expect(title()).toBe('解析修复成功')
  })
  it('repairs invalid interface references once and applies only a valid response', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    const invalid = {
      ...instance.document,
      source:
        'root = Button({"id":"root","child":"label","events":{"click":{"actions":[{"type":"api","name":"invented"}]}}}, [label])\nlabel = Text({"id":"label","text":"查询"}, [])',
    }
    generate
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce({ ...instance.document, title: '修正后的作品' })
    await send('增加查询交互')
    expect(generate).toHaveBeenCalledTimes(2)
    expect(generate.mock.calls[1]![0]).toContain('invented 未配置')
    expect(generate.mock.calls[1]![0].length).toBeLessThanOrEqual(4000)
    expect(title()).toBe('修正后的作品')
    expect(wrapper!.get('.lu-conversation').text()).toContain('已自动修正')
  })

  it('keeps the original work when a repair fails and does not retry transport errors automatically', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    const invalid = {
      ...instance.document,
      source:
        'root = Button({"id":"root","child":"label","events":{"click":{"actions":[{"type":"api","name":"invented"}]}}}, [label])\nlabel = Text({"id":"label","text":"查询"}, [])',
    }
    generate.mockResolvedValue(invalid)
    await send('增加查询交互')
    expect(generate).toHaveBeenCalledTimes(3)
    expect(title()).toBe(instance.document.title)
    expect(wrapper!.get('.lu-chat-message.is-error').text()).toContain('未配置')
    generate.mockReset().mockRejectedValue(new Error('服务连接失败'))
    await send('重试新要求')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(title()).toBe(instance.document.title)
  })

  it('undoes and redoes AI changes without removing chat messages', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    generate.mockResolvedValue({ ...instance.document, title: 'AI 新版本' })
    await send('换一个标题')
    await wrapper!.get('button[aria-label="撤销修改"]').trigger('click')
    expect(title()).toBe(instance.document.title)
    expect(wrapper!.get('.lu-conversation').text()).toContain('换一个标题')
    await wrapper!.get('button[aria-label="重做修改"]').trigger('click')
    expect(title()).toBe('AI 新版本')
  })
  it('starts an unsaved blank work with every LingUI component available', async () => {
    const { save } = await setup()
    await press('从空白组件开始')
    const studio = wrapper!.findComponent(ComponentStudio)
    expect(studio.props('instance').document.schemaVersion).toBe('lingui.document/2')
    const choices = studio.get('select[aria-label="要添加的组件类型"]')
    expect(choices.findAll('option')).toHaveLength(componentNames.length)
    await choices.setValue('LingUI.Gauge')
    await press('＋ 添加组件')
    expect(Object.values(resolveDocument(studio.props('instance').document).nodes)).toEqual(
      expect.arrayContaining([expect.objectContaining({ component: 'LingUI.Gauge' })]),
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('retains the same preview state and composer text when switching mobile workspace panels', async () => {
    await setup(createInstance(examples.find((example) => example.id === 'checklist')!.create()))
    const host = wrapper!.get('.lu-canvas .lingui-renderer-host').element
    const checkbox = host.shadowRoot!.querySelector<HTMLInputElement>('input[type=checkbox]')!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    await wrapper!.get('[aria-label="组件创作需求"]').setValue('待发送的修改要求')
    await press('实时预览')
    expect(wrapper!.get('.lu-creation-grid').attributes('data-panel')).toBe('preview')
    await press('AI 对话')
    expect(wrapper!.get('.lu-creation-grid').attributes('data-panel')).toBe('chat')
    expect(wrapper!.get('.lu-canvas .lingui-renderer-host').element).toBe(host)
    expect(checkbox.checked).toBe(true)
    expect(wrapper!.get<HTMLTextAreaElement>('[aria-label="组件创作需求"]').element.value).toBe(
      '待发送的修改要求',
    )
  })
  it('prevents duplicate saves while pending and keeps save failures visible in the dialog', async () => {
    const { save } = await setup(createInstance(examples[0]!.create()))
    let reject!: (error: Error) => void
    save.mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise
        }),
    )
    await press('保存项目')
    const dialog = wrapper!.findComponent(SaveTemplateDialog)
    dialog.vm.$emit('save', '作品名称', '内容表达', '说明')
    dialog.vm.$emit('save', '作品名称', '内容表达', '说明')
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
    expect(dialog.props('busy')).toBe(true)
    reject(new Error('保存失败，请重试'))
    await flushPromises()
    expect(dialog.props('busy')).toBe(false)
    expect(dialog.get('[role="alert"]').text()).toContain('保存失败，请重试')
    expect(dialog.get<HTMLInputElement>('input[name="name"]').element.value).toBe(
      examples[0]!.create().title,
    )
    expect(wrapper!.findComponent(SaveTemplateDialog).exists()).toBe(true)
  })
  it('offers existing categories and makes a newly saved category available on the next save', async () => {
    const definition = examples[0]!.create()
    const templates: TemplateRecord[] = [
      {
        id: 'existing-category-project',
        name: '已有作品',
        category: '内容表达',
        description: '',
        revisions: [{ version: 1, createdAt: '2026-10-16T00:00:00Z', document: definition }],
      },
    ]
    const { save } = await setup(createInstance(definition), templates)
    save.mockImplementation(async (record) => {
      const saved = { ...record, versionToken: 1 }
      templates.push(saved)
      return saved
    })
    await press('保存项目')
    let dialog = wrapper!.findComponent(SaveTemplateDialog)
    expect(dialog.props('categories')).toEqual(['内容表达'])
    expect(
      dialog
        .get('select[name="category"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toEqual(['选择已有分类，或输入新分类', '未分类', '内容表达'])
    // Halo's enhanced FormKit select emits the same value for a selected or newly created option.
    const categoryField = dialog
      .findAllComponents({ name: 'FormKit' })
      .find((field) => field.props('name') === 'category')!
    await categoryField.vm.$emit('update:modelValue', '  接口组件  ')
    await flushPromises()
    await dialog.get('form').trigger('submit')
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]![0].category).toBe('接口组件')
    await press('保存新版本')
    dialog = wrapper!.findComponent(SaveTemplateDialog)
    expect(dialog.props('categories')).toEqual(['内容表达', '接口组件'])
    expect(
      dialog
        .get('select[name="category"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toContain('接口组件')
    expect(dialog.get<HTMLSelectElement>('select[name="category"]').element.value).toBe('接口组件')
  })
  it('applies a requested theme, keeps it on content-only edits and saves it with the revision', async () => {
    const { generate, save } = await setup()
    const definition = examples.find((example) => example.id === 'spring-flux')!.create()
    const theme = {
      ...pureTheme,
      id: 'ai-user-style',
      name: '用户指定的直角主题',
      radius: 0,
      colors: { ...pureTheme.colors, accent: '#7c3aed' },
    }
    generate
      .mockResolvedValueOnce({ document: definition, theme })
      .mockResolvedValueOnce({ ...definition, title: '调整后的图解' })
    save.mockImplementation(async (record) => ({ ...record, versionToken: 1 }))
    await send('改为紫色和直角风格')
    const surface = wrapper!
      .get('.lu-canvas .lingui-renderer-host')
      .element.shadowRoot!.querySelector<HTMLElement>('.lingui-surface')!
    expect(surface.style.getPropertyValue('--lingui-radius')).toBe('0px')
    expect(surface.style.getPropertyValue('--lingui-accent')).toBe('#7c3aed')
    expect(wrapper!.get<HTMLSelectElement>('[aria-label="预览主题"]').element.value).toBe(theme.id)
    await send('标题再短一点，其他保留')
    expect(wrapper!.get<HTMLSelectElement>('[aria-label="预览主题"]').element.value).toBe(theme.id)
    await press('保存项目')
    wrapper!.findComponent(SaveTemplateDialog).vm.$emit('save', '调整后的图解', '技术图解', '说明')
    await flushPromises()
    expect(save.mock.calls[0]![0].revisions.at(-1)!.theme).toEqual(theme)
  })
  it('opens on the composer and applies generation directly to the interactive preview without saving', async () => {
    const { generate, save } = await setup()
    const definition = examples.find((example) => example.id === 'faq')!.create()
    generate.mockResolvedValue(definition)
    expect(wrapper!.get('[aria-label="AI 创作对话"]').isVisible()).toBe(true)
    expect(wrapper!.find('.lu-project-grid').exists()).toBe(false)
    expect(wrapper!.get('.lu-artifact-empty').text()).toContain('你的作品会出现在这里')
    await send('生成可折叠的 FAQ')
    expect(generate).toHaveBeenCalledExactlyOnceWith(
      '生成可折叠的 FAQ',
      undefined,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onProgress: expect.any(Function),
      }),
    )
    expect(title()).toBe(definition.title)
    expect(wrapper!.get('.lu-conversation').text()).toContain('生成可折叠的 FAQ')
    expect(wrapper!.get('.lu-conversation').text()).toContain(`已生成「${definition.title}」`)
    const host = wrapper!.get('.lu-canvas .lingui-renderer-host').element
    expect(host.shadowRoot!.querySelectorAll('details').length).toBeGreaterThan(1)
    expect(save).not.toHaveBeenCalled()
    await press('组件市场')
    await press('开发工作台')
    expect(wrapper!.get('.lu-conversation').text()).toContain('生成可折叠的 FAQ')
  })

  it('includes manually edited content and earlier requests in the next AI turn', async () => {
    const { generate } = await setup()
    const definition = examples.find((example) => example.id === 'faq')!.create()
    generate
      .mockResolvedValueOnce(definition)
      .mockResolvedValueOnce({ ...definition, title: '新的 FAQ' })
    await send('生成可折叠的 FAQ')
    await wrapper!.get('input[aria-label="组件名称"]').setValue('手动调整后的作品')
    await wrapper!.get('input[aria-label="组件名称"]').trigger('change')
    await press('手动编辑')
    expect(wrapper!.get('.lu-manual-editor').isVisible()).toBe(true)
    await wrapper!
      .findAll('.lu-tree-item')
      .find((item) => item.get('.lu-tree-id').text() === 'content')!
      .trigger('click')
    await wrapper!.get('select[aria-label="要添加的组件类型"]').setValue('Text')
    await press('＋ 添加组件')
    await wrapper!.get('.lu-properties textarea').setValue('保留这段手动补充')
    await wrapper!.get('.lu-properties textarea').trigger('change')
    await flushPromises()
    await send('再增加一个问题')
    const [instruction, document] = generate.mock.calls[1]!
    expect(instruction).toContain('生成可折叠的 FAQ')
    expect(instruction).toContain('再增加一个问题')
    expect(document!.title).toBe('手动调整后的作品')
    expect(JSON.stringify(document)).toContain('保留这段手动补充')
    expect(title()).toBe('新的 FAQ')
    expect(wrapper!.findAll('.lu-chat-message.is-user')).toHaveLength(2)
  })

  it('retains manual changes made while AI is generating until the author chooses the result', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    const response = deferred()
    generate.mockReturnValue(response.promise)
    await send('修改这份组件')
    expect(wrapper!.get('.lu-prompt-send').attributes('aria-label')).toBe('停止生成')
    expect(wrapper!.get('.lu-prompt-send').attributes('disabled')).toBeUndefined()
    expect(wrapper!.get('.lu-operation-hint').text()).toContain('完成后')
    expect(
      wrapper!
        .findAll('button')
        .find((button) => button.text().trim() === '新建对话')!
        .attributes('title'),
    ).toContain('AI 正在创作')
    await wrapper!.get('input[aria-label="组件名称"]').setValue('生成中手动修改')
    await wrapper!.get('input[aria-label="组件名称"]').trigger('change')
    expect(wrapper!.get('button[aria-label="撤销修改"]').attributes('aria-description')).toContain(
      'AI 正在创作',
    )
    response.resolve({ ...instance.document, title: 'AI 返回的作品' })
    await flushPromises()
    expect(title()).toBe('生成中手动修改')
    expect(wrapper!.get('.lu-ai-conflict').text()).toContain('生成期间你手动修改了组件')
    expect(wrapper!.get('.lu-operation-hint').text()).toContain('选择保留当前修改')
    await wrapper!.get('textarea[aria-label="组件创作需求"]').setValue('暂不发送')
    await wrapper!.get('.lu-prompt-box').trigger('submit')
    expect(generate).toHaveBeenCalledTimes(1)
    await press('采用 AI 结果')
    expect(title()).toBe('AI 返回的作品')
    expect(wrapper!.find('.lu-ai-conflict').exists()).toBe(false)
  })

  it('keeps the current component on failure and retries using its latest content', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    generate
      .mockRejectedValueOnce(new Error('模型暂时不可用'))
      .mockResolvedValueOnce(instance.document)
    await send('把标题改短一点')
    expect(title()).toBe(instance.document.title)
    expect(wrapper!.get('.lu-chat-message.is-error').text()).toContain('模型暂时不可用')
    await press('重试生成')
    expect(generate).toHaveBeenCalledTimes(2)
    expect(generate.mock.calls[1]![0]).toBe('把标题改短一点')
    expect(wrapper!.get('.lu-conversation').text()).toContain('已生成')
  })

  it('includes current article parameter values in the AI context without changing the source document', async () => {
    const instance = createInstance(examples.find((example) => example.id === 'notice')!.create())
    instance.parameters.title = '手动设置的标题'
    const { generate } = await setup(instance)
    generate.mockResolvedValue(instance.document)
    await send('保持标题，调整其他内容')
    const context = generate.mock.calls[0]![1]!
    expect(context.parameters.find((parameter) => parameter.key === 'title')!.default).toBe(
      '手动设置的标题',
    )
    expect(
      wrapper!.get('.lu-canvas .lingui-renderer-host').element.shadowRoot!.textContent,
    ).toContain('手动设置的标题')
    expect(
      instance.document.parameters.find((parameter) => parameter.key === 'title')!.default,
    ).not.toBe('手动设置的标题')
  })

  it('passes configured business capabilities to AI and retains them if generated output omits or changes them', async () => {
    const instance = createInstance(examples[0]!.create())
    const integrations = {
      apis: [
        {
          name: 'searchArticles',
          label: '查询文章',
          method: 'GET' as const,
          url: '/business-api/articles',
          inputExample: { q: '' },
          responseExample: { items: [{ id: 1, name: '文章' }] },
        },
      ],
      callbacks: [{ name: 'onSelected', label: '选择后', inputExample: { id: 1 } }],
    }
    instance.document.integrations = integrations
    const { generate } = await setup(instance)
    const { integrations: _unused, ...withoutIntegrations } = instance.document
    generate.mockResolvedValueOnce(withoutIntegrations).mockResolvedValueOnce({
      ...instance.document,
      integrations: { apis: [{ ...integrations.apis[0]!, url: '/invented' }], callbacks: [] },
    })
    await send('用配置的接口创建搜索列表')
    expect(generate.mock.calls[0]![1]!.integrations).toEqual(integrations)
    expect(wrapper!.findComponent(ComponentStudio).props('instance').document.integrations).toEqual(
      integrations,
    )
    await send('优化搜索结果样式')
    expect(wrapper!.findComponent(ComponentStudio).props('instance').document.integrations).toEqual(
      integrations,
    )
  })

  it('guards a new conversation when the current work has unsaved changes', async () => {
    const { generate } = await setup()
    generate.mockResolvedValue(examples[0]!.create())
    await send('生成一份组件')
    const warning = vi.spyOn(Dialog, 'warning').mockImplementation(() => undefined as never)
    await press('新建对话')
    expect(warning).toHaveBeenCalledOnce()
    expect(wrapper!.find('input[aria-label="组件名称"]').exists()).toBe(true)
    await warning.mock.calls[0]![0]!.onConfirm?.()
    await flushPromises()
    expect(wrapper!.find('input[aria-label="组件名称"]').exists()).toBe(false)
    expect(wrapper!.findAll('.lu-chat-message')).toHaveLength(0)
  })

  it('rejects an invalid AI response without replacing the current work and shows actionable feedback', async () => {
    const instance = createInstance(examples[0]!.create())
    const { generate } = await setup(instance)
    generate.mockResolvedValue({ ...instance.document, source: 'root = Unknown({}, [])' })
    await send('调整现有组件')
    expect(title()).toBe(instance.document.title)
    expect(wrapper!.get('.lu-chat-message.is-error > p').text()).toContain('请重试')
    expect(wrapper!.get('.lu-chat-error-details').text()).toContain('OpenUI')
  })

  it('does not submit while composing Chinese or pressing Shift + Enter', async () => {
    const { generate } = await setup()
    generate.mockResolvedValue(examples[0]!.create())
    const input = wrapper!.get('textarea[aria-label="组件创作需求"]')
    await input.setValue('一个互动组件')
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    await input.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(generate).not.toHaveBeenCalled()
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(generate).toHaveBeenCalledTimes(1)
  })
})

it('bounds conversation context to the existing API limit and excludes failed requests', () => {
  const messages: ConversationMessage[] = Array.from({ length: 8 }, (_, id) => ({
    id,
    role: 'user',
    text: `${id}${'字'.repeat(900)}`,
    status: id === 7 ? 'error' : 'done',
  }))
  const instruction = conversationInstruction(messages, '本次修改')
  expect(instruction.length).toBeLessThanOrEqual(4000)
  expect(instruction).toContain(messages[6]!.text)
  expect(instruction).not.toContain(messages[7]!.text)
  expect(conversationInstruction(messages, '改'.repeat(4000))).toHaveLength(4000)
})
