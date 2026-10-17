import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { examples } from '@lingui/renderer'
import ComponentLibrary from '../component-library/ComponentLibrary.vue'
import type { TemplateRecord } from '../component-library/types'
import { repositoryKey } from '../services/repository'
import { createHaloRepository } from '../services/halo-repository'
import { embedClientKey } from '../component-embed/client'

let view: VueWrapper | undefined
let status: ReturnType<typeof vi.fn>
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  view?.unmount()
  document.body.replaceChildren()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  vi.restoreAllMocks()
})

function project(): TemplateRecord {
  return {
    id: 'project-preview',
    name: '组件预览验收',
    category: '内容表达',
    description: '交互提示',
    revisions: [1, 2].map((version) => {
      const document = examples.find((example) => example.id === 'notice')!.create()
      document.parameters[0]!.default = `第 ${version} 版提示`
      return { version, createdAt: `2026-10-${10 + version}T00:00:00Z`, document }
    }),
  }
}
function render(templates = [project()], enabled = true) {
  status = vi.fn(async () => ({ name: templates[0]!.id, enabled, revision: 2 }))
  view = mount(ComponentLibrary, {
    attachTo: document.body,
    props: { templates, loading: false },
    global: {
      provide: {
        [repositoryKey as symbol]: createHaloRepository(),
        [embedClientKey as symbol]: { status },
      },
      stubs: { transition: false },
    },
  })
  return view
}
function previewRoot() {
  return document.querySelector('.lu-project-preview-surface .lingui-renderer-host')!.shadowRoot!
}
function dialogButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    (button) => button.textContent?.trim() === label,
  )!
}

describe('project previews', () => {
  it('copies directly from the project card without opening a dialog or changing the project', async () => {
    const clipboard = { writeText: vi.fn(async () => undefined) }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
    const template = project()
    const original = JSON.stringify(template)
    const library = render([template])
    await flushPromises()
    expect(status).not.toHaveBeenCalled()
    await library.get('.lu-project-copy').trigger('click')
    await flushPromises()
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      `<lingui-component data-lingui="${template.id}"></lingui-component>`,
    )
    expect(library.get('.lu-project-copy').text()).toBe('已复制')
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(library.emitted('open')).toBeUndefined()
    await library.get('.lu-project-menu summary').trigger('click')
    await library
      .findAll('.lu-dropdown button')
      .find((button) => button.text() === '复制嵌入代码')!
      .trigger('click')
    await flushPromises()
    expect(document.querySelector<HTMLTextAreaElement>('[aria-label="组件嵌入代码"]')!.value).toBe(
      `<lingui-component data-lingui="${template.id}"></lingui-component>`,
    )
    expect(document.body.textContent).not.toContain('独立快照')
    expect(library.emitted('duplicate')).toBeUndefined()
    expect(JSON.stringify(template)).toBe(original)
  })

  it('opens publishing settings instead of copying an unusable private reference', async () => {
    const clipboard = { writeText: vi.fn(async () => undefined) }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
    const library = render([project()], false)
    await library.get('.lu-project-copy').trigger('click')
    await flushPromises()
    expect(clipboard.writeText).not.toHaveBeenCalled()
    expect(document.querySelector('[role=dialog]')).not.toBeNull()
    expect(document.body.textContent).toContain('开启后，访客可通过组件 ID 读取')
  })

  it('copies the project ID from history while retaining the selected preview', async () => {
    const library = render()
    await library.get('.lu-project-menu summary').trigger('click')
    await library
      .findAll('.lu-dropdown button')
      .find((button) => button.text() === '版本记录')!
      .trigger('click')
    await flushPromises()
    document.querySelectorAll<HTMLButtonElement>('.lu-project-history button')[1]!.click()
    await flushPromises()
    dialogButton('复制嵌入代码').click()
    await flushPromises()
    const container = document.createElement('div')
    container.innerHTML =
      document.querySelector<HTMLTextAreaElement>('[aria-label="组件嵌入代码"]')!.value
    expect(container.firstElementChild!.getAttribute('data-lingui')).toBe(project().id)
    expect(document.body.textContent).toContain('历史版本不会影响标签')
    const dialogs = document.querySelectorAll('[role="dialog"]')
    expect(dialogs).toHaveLength(2)
    const close = [...dialogs[1]!.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === '关闭',
    )!
    close.click()
    await flushPromises()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(previewRoot().textContent).toContain('第 1 版提示')
  })

  it('renders the latest saved revision immediately with an inert thumbnail', async () => {
    const library = render()
    await flushPromises()
    const thumbnail = library.get('.lu-project-thumbnail')
    expect(thumbnail.attributes()).toHaveProperty('inert')
    expect(thumbnail.get('.lingui-renderer-host').element.shadowRoot!.textContent).toContain(
      '第 2 版提示',
    )
    expect(thumbnail.get('.lingui-renderer-host').element.shadowRoot!.textContent).not.toContain(
      '第 1 版提示',
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(library.get('.lu-project-preview-button').find('.lingui-renderer-host').exists()).toBe(
      false,
    )
  })

  it('isolates trial interaction from the saved project and thumbnail and resets the trial', async () => {
    const template = project()
    const saved = JSON.stringify(template)
    const library = render([template])
    await library.get('.lu-project-preview-button').trigger('click')
    await flushPromises()
    previewRoot().querySelector('summary')!.click()
    await flushPromises()
    expect(previewRoot().querySelector('details')!.open).toBe(true)
    const thumbnail = library.get('.lu-project-thumbnail .lingui-renderer-host').element.shadowRoot!
    expect(thumbnail.querySelector('details')!.open).toBe(false)
    expect(JSON.stringify(template)).toBe(saved)
    dialogButton('重置预览').click()
    await flushPromises()
    expect(previewRoot().querySelector('details')!.open).toBe(false)
    dialogButton('关闭').click()
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('previews a historical revision and opens that revision for editing', async () => {
    const template = project()
    const library = render([template])
    await library.get('.lu-project-menu summary').trigger('click')
    await library
      .findAll('.lu-dropdown button')
      .find((button) => button.text() === '版本记录')!
      .trigger('click')
    await flushPromises()
    const revisions = document.querySelectorAll<HTMLButtonElement>('.lu-project-history button')
    expect(revisions[0]!.getAttribute('aria-pressed')).toBe('true')
    revisions[1]!.click()
    await flushPromises()
    expect(previewRoot().textContent).toContain('第 1 版提示')
    expect(previewRoot().textContent).not.toContain('第 2 版提示')
    dialogButton('编辑 v1').click()
    await flushPromises()
    expect(library.emitted('open')?.[0]).toEqual([template, 1])
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('combines category and trimmed case-insensitive search and can clear empty results', async () => {
    const first = { ...project(), name: 'Alpha 项目' }
    const second = { ...project(), id: 'other', name: 'Beta 项目', category: '实用工具' }
    const library = render([second, first])
    await library.get('[aria-label="项目排序"]').setValue('name')
    expect(library.findAll('.lu-project-card h3').map((title) => title.text())).toEqual([
      'Alpha 项目',
      'Beta 项目',
    ])
    await library.get('[aria-label="搜索项目"]').setValue(' ALPHA ')
    expect(library.findAll('.lu-project-card')).toHaveLength(1)
    await library
      .findAll('.lu-project-filters button')
      .find((button) => button.text().startsWith('实用工具'))!
      .trigger('click')
    expect(library.findAll('.lu-project-card')).toHaveLength(0)
    await library.get('.lu-project-empty button').trigger('click')
    expect(library.findAll('.lu-project-card')).toHaveLength(2)
  })
})
