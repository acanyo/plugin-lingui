import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { h, ref } from 'vue'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import { createInstance, examples } from '@lingui/renderer'
import {
  Editor,
  ExtensionDocument,
  ExtensionParagraph,
  ExtensionText,
  EditorHeader,
  VueEditor,
} from '@halo-dev/richtext-editor'
import { createHaloRepository } from '../services/halo-repository'
import { Toast, VDropdown } from '@halo-dev/components'
import { openStudio } from '../editor-extension/open-studio'
import { nodeAttributes } from '../editor-extension/serialization'
import { LinguiNode } from '../editor-extension/LinguiNode'
import StudioDialog from '../editor-extension/StudioDialog.vue'
import ImportDialog from '../shared/ImportDialog.vue'
import SaveTemplateDialog from '../component-library/SaveTemplateDialog.vue'
import { marketService } from '../marketplace/market-service'
import StudioModal from '../shared/StudioModal.vue'
import { captureArticleSource } from '../article-transform/source'
import StudioView from '../views/StudioView.vue'
import type { TemplateRecord } from '../component-library/types'
import { utils } from '@halo-dev/ui-shared'

vi.mock('../component-embed/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../component-embed/client')>()
  return {
    ...original,
    createEmbedClient: () => ({
      status: async (name: string) => ({ name, enabled: true, revision: 1 }),
      enable: vi.fn(),
      disable: vi.fn(),
    }),
  }
})

vi.mock('../services/halo-repository', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/halo-repository')>()
  return {
    ...original,
    createHaloRepository: vi.fn(() => ({
      ...original.createHaloRepository(),
      listTemplates: async () => structuredClone(projects),
      saveTemplate: async (record: TemplateRecord) => {
        const saved = structuredClone({ ...record, versionToken: 1 })
        projects.push(saved)
        return saved
      },
      listThemes: async () => [],
    })),
  }
})

let view: VueWrapper | undefined
let editor: Editor | undefined
let projects: TemplateRecord[] = []
const originalPermissions = utils.permission.getUserPermissions()
beforeEach(() => {
  projects = []
  utils.permission.setUserPermissions(['*'])
  const works = examples
    .filter((example) => ['notice', 'quiz'].includes(example.id))
    .map((example) => ({
      ...example,
      id: `work-${example.id}`,
      source: 'community' as const,
      publisher: '市场作者',
      license: 'MIT',
      version: '1.0.0',
    }))
  vi.spyOn(marketService, 'list').mockImplementation(async (_page, query = '') => {
    const filtered = works.filter((work) => work.title.includes(query))
    return {
      items: filtered.map((work) => ({ name: work.id, title: work.title })),
      total: filtered.length,
    }
  })
  vi.spyOn(marketService, 'get').mockImplementation(async (id) =>
    works.find((work) => work.id === id)!,
  )
})
afterEach(() => {
  utils.permission.setUserPermissions(originalPermissions ?? [])
  document.querySelector<HTMLButtonElement>('button[aria-label="关闭工作室"]')?.click()
  view?.unmount()
  view = undefined
  editor?.destroy()
  editor = undefined
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
async function openInsertMenu() {
  await view!.get('[aria-controls^="editor-toolbox-"]').trigger('click')
  await vi.waitFor(() => {
    expect(document.querySelector('[role="menuitem"][aria-label="插入灵构 UI"]')).not.toBeNull()
  })
}

describe('Halo modal entry points', () => {
  it('requests close without hiding guarded content and blocks Esc during a pending operation', async () => {
    view = mount(StudioModal, {
      attachTo: document.body,
      props: { title: '受保护的编辑' },
      slots: { default: '<input aria-label="正在编辑的内容" />' },
      global: { stubs: { transition: false } },
    })
    await flushPromises()
    await view.get('input').trigger('keydown', { key: 'Escape' })
    await view.get('input').trigger('keyup', { key: 'Escape' })
    expect(view.emitted('close')).toHaveLength(1)
    expect(view.get('.modal-content').isVisible()).toBe(true)
    await view.setProps({ closeDisabled: true })
    await view.get('input').trigger('keydown', { key: 'Escape' })
    await view.get('input').trigger('keyup', { key: 'Escape' })
    expect(view.emitted('close')).toHaveLength(1)
    expect(view.get('.modal-content').isVisible()).toBe(true)
  })
  it('lets an expanded shadow-root selector close before its enclosing studio modal', async () => {
    view = mount(StudioModal, {
      attachTo: document.body,
      props: { title: '组件预览' },
      slots: { default: '<div id="selector-host"></div>' },
      global: { stubs: { transition: false } },
    })
    await flushPromises()
    const root = view.get('#selector-host').element.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<details open class="lg-multi-select"><summary>选择</summary><input></details>'
    const details = root.querySelector('details')!
    details.addEventListener(
      'keydown',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
        details.open = false
      },
      { once: true },
    )
    root
      .querySelector('input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))
    expect(view.emitted('close')).toBeUndefined()
    root
      .querySelector('summary')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))
    expect(view.emitted('close')).toHaveLength(1)
  })
  it('closes a Halo category dropdown with the first Escape and the dialog with the next', async () => {
    const expanded = ref(true)
    view = mount(StudioModal, {
      attachTo: document.body,
      props: { title: '保存项目' },
      slots: {
        default: () =>
          h(
            VDropdown,
            { shown: expanded.value, triggers: [], autoHide: false },
            {
              default: () =>
                h('div', { class: 'select-container' }, [
                  h('input', {
                    'aria-label': '搜索分类',
                    onKeydown: (event: KeyboardEvent) => {
                      if (event.key === 'Escape') expanded.value = false
                    },
                  }),
                ]),
              popper: () => h('div', '内容表达'),
            },
          ),
      },
      global: { stubs: { transition: false } },
    })
    await flushPromises()
    await vi.waitFor(() => expect(view!.get('.v-popper').classes()).toContain('v-popper--shown'))
    await view.get('input').trigger('keydown', { key: 'Escape' })
    await view.get('input').trigger('keyup', { key: 'Escape' })
    await flushPromises()
    expect(expanded.value).toBe(false)
    expect(view.emitted('close')).toBeUndefined()
    await vi.waitFor(() =>
      expect(view!.get('.v-popper').classes()).not.toContain('v-popper--shown'),
    )
    await view.get('input').trigger('keydown', { key: 'Escape' })
    await view.get('input').trigger('keyup', { key: 'Escape' })
    expect(view.emitted('close')).toHaveLength(1)
  })
  it('opens the project picker from the green insert menu and inserts an editable node into the actual Tiptap editor', async () => {
    const headerEditor = new VueEditor({
      extensions: [ExtensionDocument, ExtensionParagraph, ExtensionText, LinguiNode],
      content: '<p></p>',
    })
    editor = headerEditor
    view = mount(EditorHeader, {
      attachTo: document.body,
      props: { editor: headerEditor },
      global: { stubs: { transition: false } },
    })
    expect(view.find('.lingui-insert-button').exists()).toBe(false)
    expect(view.get('[role="toolbar"]').text()).not.toContain('灵构 UI')
    expect(view.get('[role="toolbar"]').text()).not.toContain('选段转互动')
    await openInsertMenu()
    document
      .querySelector<HTMLButtonElement>('[role="menuitem"][aria-label="插入灵构 UI"]')!
      .click()
    await flushPromises()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.style.display).not.toBe('none')
    const market = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === '应用市场',
    )!
    market.click()
    await flushPromises()
    const search = dialog.querySelector<HTMLInputElement>('[aria-label="搜索市场作品"]')!
    search.value = '重要提示'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const example = await vi.waitFor(() => {
      const button = dialog.querySelector<HTMLButtonElement>(
        '[aria-label="下载到我的项目重要提示"]',
      )
      expect(button).not.toBeNull()
      return button!
    })
    example.click()
    await flushPromises()
    expect(projects).toHaveLength(1)
    expect(editor.getJSON().content!.some((node) => node.type === 'linguiComponent')).toBe(false)
    const insert = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === '插入文章',
    )!
    insert.click()
    await flushPromises()
    const node = editor.getJSON().content!.find((item) => item.type === 'linguiComponent')!
    expect(node.attrs).toEqual({ componentId: projects[0]!.id })
    expect(projects[0]!.name).toBe('重要提示')
    expect(editor.getHTML()).toContain('data-lingui=')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('inserts after a selected component without replacing its project reference', async () => {
    const original = {
      ...createInstance(examples.find((example) => example.id === 'comparison')!.create()),
      templateId: 'component-original',
    }
    const headerEditor = new VueEditor({
      extensions: [ExtensionDocument, ExtensionParagraph, ExtensionText, LinguiNode],
      content: {
        type: 'doc',
        content: [{ type: 'linguiComponent', attrs: await nodeAttributes(original) }],
      },
    })
    editor = headerEditor
    editor.commands.setNodeSelection(0)
    view = mount(EditorHeader, {
      attachTo: document.body,
      props: { editor: headerEditor },
      global: { stubs: { transition: false } },
    })
    await openInsertMenu()
    document
      .querySelector<HTMLButtonElement>('[role="menuitem"][aria-label="插入灵构 UI"]')!
      .click()
    await flushPromises()
    const market = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (button) => button.textContent?.trim() === '应用市场',
    )!
    market.click()
    await flushPromises()
    document.querySelector<HTMLButtonElement>('[aria-label="下载到我的项目知识测验"]')!.click()
    await flushPromises()
    const insert = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (button) => button.textContent?.trim() === '插入文章',
    )!
    insert.click()
    await flushPromises()
    const nodes = editor.getJSON().content!.filter((node) => node.type === 'linguiComponent')
    expect(nodes).toHaveLength(2)
    expect(nodes[0]!.attrs).toEqual({ componentId: original.templateId })
    expect(nodes[1]!.attrs).toEqual({ componentId: projects[0]!.id })
    expect(projects[0]!.name).toBe('知识测验')
  })

  it('keeps the article selection when opening selection-to-interaction from the green insert menu', async () => {
    const source = 'JVM 堆保存对象，线程共享。'
    const headerEditor = new VueEditor({
      extensions: [ExtensionDocument, ExtensionParagraph, ExtensionText, LinguiNode],
      content: `<p>${source}</p><p>不发送的后续段落。</p>`,
    })
    editor = headerEditor
    editor.commands.setTextSelection({ from: 1, to: source.length + 1 })
    view = mount(EditorHeader, {
      attachTo: document.body,
      props: { editor: headerEditor },
      global: { plugins: [[formkit, defaultConfig()]], stubs: { transition: false } },
    })
    await openInsertMenu()
    document.querySelector<HTMLButtonElement>('[role="menuitem"][aria-label="选段转互动"]')!.click()
    await flushPromises()
    expect(document.querySelector('.lu-article-source')?.textContent).toBe(source)
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('不发送的后续段落')
    const cancel = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (button) => button.textContent?.trim() === '取消',
    )!
    cancel.click()
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(editor.getText()).toContain(source)
  })

  it('saves changed parameters into a project before applying its ID reference', async () => {
    const instance = createInstance(examples.find((example) => example.id === 'notice')!.create())
    view = mount(StudioDialog, {
      attachTo: document.body,
      props: { instance },
      global: { stubs: { transition: false } },
    })
    await flushPromises()
    expect(view.get('.modal-layer').isVisible()).toBe(true)
    expect(view.get('.modal-content').isVisible()).toBe(true)
    await view
      .findAll('button')
      .find((button) => button.text().trim() === '手动编辑')!
      .trigger('click')
    await view
      .findAll('button')
      .find((button) => button.text() === '参数')!
      .trigger('click')
    const input = view.get('.lu-instance-parameters input[type="text"]')
    await input.setValue('在文章编辑器中修改的标题')
    await input.trigger('change')
    await flushPromises()
    const preview = view.get('.lu-canvas .lingui-renderer-host').element.shadowRoot!
    expect(preview.textContent).toContain('在文章编辑器中修改的标题')
    await view
      .findAll('button')
      .find((button) => button.text() === '保存并插入文章')!
      .trigger('click')
    await flushPromises()
    expect(projects).toHaveLength(1)
    expect(
      projects[0]!.revisions[0]!.document.parameters.find((item) => item.key === 'title')!.default,
    ).toBe('在文章编辑器中修改的标题')
    expect(view.emitted('insert')?.[0]?.[0]).toMatchObject({
      templateId: projects[0]!.id,
      parameters: { title: '在文章编辑器中修改的标题' },
    })
    expect(instance.parameters.title).not.toBe('在文章编辑器中修改的标题')
    expect(createHaloRepository).toHaveBeenCalled()
  })

  it('keeps the editable dialog open if applying to the article fails', async () => {
    editor = new Editor({
      extensions: [ExtensionDocument, ExtensionParagraph, ExtensionText, LinguiNode],
      content: '<p></p>',
    })
    const toast = vi.spyOn(Toast, 'error')
    openStudio(
      editor,
      async () => {
        throw new Error('Unable to apply transaction')
      },
      createInstance(examples[0]!.create()),
    )
    await flushPromises()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const apply = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === '保存并插入文章',
    )!
    apply.click()
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBe(dialog)
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('当前修改已保留'))
  })

  it('forwards the current article reference with the reviewed work rather than a captured initial selection', async () => {
    editor = new Editor({
      extensions: [ExtensionDocument, ExtensionParagraph, ExtensionText, LinguiNode],
      content: '<p>堆保存对象，线程共享。</p><p>栈保存局部变量，线程私有。</p>',
    })
    editor.commands.setTextSelection({ from: 1, to: 10 })
    const initial = captureArticleSource(editor)
    editor.commands.setTextSelection({ from: 16, to: 24 })
    const restored = captureArticleSource(editor)
    const instance = createInstance(examples[0]!.create())
    view = mount(StudioDialog, {
      props: { instance, article: { source: initial, prompt: '制作测验' } },
      global: { stubs: { transition: false } },
    })
    await flushPromises()
    view.getComponent(StudioView).vm.$emit('insert', instance, restored)
    await flushPromises()
    expect(view.emitted('insert')?.[0]?.[1]).toEqual(restored)
    expect((view.emitted('insert')?.[0]?.[0] as { templateId: string }).templateId).toBe(
      projects[0]!.id,
    )
  })

  it('opens the JSON import dialog on its first mount', async () => {
    view = mount(ImportDialog, {
      attachTo: document.body,
      global: { stubs: { transition: false } },
    })
    await flushPromises()
    expect(view.get('.modal-layer').isVisible()).toBe(true)
    expect(view.get('.modal-content').isVisible()).toBe(true)
  })

  it('opens the template save dialog on its first mount', async () => {
    view = mount(SaveTemplateDialog, {
      attachTo: document.body,
      props: { name: '重要提示', updating: false },
      global: { stubs: { transition: false } },
    })
    await flushPromises()
    expect(view.get('.modal-layer').isVisible()).toBe(true)
    expect(view.get('.modal-content').isVisible()).toBe(true)
  })
})
