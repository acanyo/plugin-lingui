import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, type ComponentInstance } from '@lingui/renderer'
import { document as definition, text } from '../../../packages/renderer/src/examples/builders'
import EmbedCodeDialog from '../component-embed/EmbedCodeDialog.vue'
import { embedClientKey } from '../component-embed/client'
import { repositoryKey } from '../services/repository'
import { createHaloRepository } from '../services/halo-repository'

let view: VueWrapper | undefined
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  document.body.replaceChildren()
})
const instance = () => ({
  ...createInstance(definition('主题天气', [text('root', '天气信息')])),
  templateId: 'component-weather',
})
function render(value: ComponentInstance = instance()) {
  view = mount(EmbedCodeDialog, {
    props: { instance: value },
    attachTo: document.body,
    global: {
      stubs: { transition: false },
      provide: {
        [repositoryKey as symbol]: createHaloRepository(),
        [embedClientKey as symbol]: {
          status: async () => ({ name: 'component-weather', enabled: true, revision: 1 }),
        },
      },
    },
  })
  return view
}
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    (item) => item.textContent?.trim() === label,
  )!
}
function code() {
  return document.querySelector<HTMLTextAreaElement>('[aria-label="组件嵌入代码"]')!
}

describe('component embedding dialog', () => {
  it('copies exactly the short project tag without resource or snapshot options', async () => {
    const clipboard = { writeText: vi.fn(async () => undefined) }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
    render()
    await flushPromises()
    expect(code().readOnly).toBe(true)
    expect(code().value).toMatch(/^<lingui-component/)
    button('复制嵌入代码').click()
    await flushPromises()
    expect(clipboard.writeText).toHaveBeenLastCalledWith(code().value)
    expect(document.body.textContent).toContain('已复制，可粘贴到主题中。')
    expect(code().value).toBe(
      '<lingui-component data-lingui="component-weather"></lingui-component>',
    )
    expect(document.querySelector('[role=dialog] input[type=checkbox]')).toBeNull()
  })

  it('selects all code with a usable instruction if the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    render()
    await flushPromises()
    button('复制嵌入代码').click()
    await flushPromises()
    expect(document.activeElement).toBe(code())
    expect(code().selectionStart).toBe(0)
    expect(code().selectionEnd).toBe(code().value.length)
    expect(document.body.textContent).toContain('代码已选中，请按 Ctrl+C 或 ⌘C 复制')
    button('关闭').click()
    await flushPromises()
    expect(view!.emitted('close')).toHaveLength(1)
  })

  it('keeps the dialog on its original project when the work changes in the background', async () => {
    const original = instance()
    const view = render(original)
    await flushPromises()
    const before = code().value
    await view.setProps({
      instance: createInstance(definition('AI 新版本', [text('root', '更新内容')])),
    })
    expect(document.querySelector('.lu-embed-code h3')!.textContent).toBe(original.document.title)
    expect(code().value).toBe(before)
  })

  it('requires a saved Halo project and still allows closing', async () => {
    render(createInstance(definition('未保存作品', [text('root', '内容')])) as ComponentInstance)
    await flushPromises()
    expect(document.body.textContent).toContain('请先在 Halo 中将作品保存为项目')
    expect(button('复制嵌入代码').disabled).toBe(true)
    expect(code()).toBeNull()
    button('关闭').click()
    await flushPromises()
    expect(view!.emitted('close')).toHaveLength(1)
  })
})
