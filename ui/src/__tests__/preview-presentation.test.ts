import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, examples, pureTheme } from '@lingui/renderer'
import PreviewPresentation from '../workspace/PreviewPresentation.vue'
import LinguiRenderer from '../shared/LinguiRenderer.vue'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
let view: VueWrapper | undefined
const dialogMethods = ['showModal', 'close'] as const
const originalMethods = dialogMethods.map((name) =>
  Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name),
)
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    }),
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }),
  })
})
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  dialogMethods.forEach((name, index) => {
    const original = originalMethods[index]
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  })
  document.body.replaceChildren()
  document.body.style.overflow = ''
})
function render() {
  const instance = createInstance(examples.find((example) => example.id === 'checklist')!.create())
  view = mount(
    defineComponent({
      render: () =>
        h(
          PreviewPresentation,
          {},
          {
            default: ({ fullscreen, toggle }: { fullscreen: boolean; toggle: () => void }) =>
              h('section', [
                h(
                  'button',
                  { 'data-preview-fullscreen': '', onClick: toggle },
                  fullscreen ? '退出全屏' : '全屏',
                ),
                h(LinguiRenderer, { instance }),
              ]),
          },
        ),
    }),
    { attachTo: document.body },
  )
  return document.querySelector<HTMLElement>('.lingui-renderer-host')!
}
describe('fullscreen live preview', () => {
  it('keeps node selection and preview mounted while editing in fullscreen and returning with Esc', async () => {
    const instance = shallowRef(
      createInstance(examples.find((example) => example.id === 'faq')!.create()),
    )
    view = mount(
      defineComponent({
        setup: () => () =>
          h(CreationWorkspace, {
            instance: instance.value,
            themes: [pureTheme],
            dirty: true,
            busy: false,
            conflicted: false,
            initialEditing: true,
            onUpdate: (value) => {
              instance.value = value
            },
          }),
      }),
      {
        attachTo: document.body,
        global: { provide: { [repositoryKey as symbol]: createLocalRepository() } },
      },
    )
    const host = view.get('.lu-artifact-canvas .lingui-renderer-host').element
    const properties = view.get('.lu-properties textarea').element as HTMLTextAreaElement
    const trigger = view.findAll('button').find((button) => button.text() === '全屏编辑')!
    ;(trigger.element as HTMLButtonElement).focus()
    await trigger.trigger('click')
    await flushPromises()
    const dialog = document.querySelector<HTMLDialogElement>('dialog')!
    expect(dialog.getAttribute('aria-label')).toBe('全屏组件编辑')
    expect(
      dialog.querySelector('.lu-artifact-panel')!.classList.contains('is-fullscreen-edit'),
    ).toBe(true)
    expect(dialog.querySelector('.lu-properties textarea')).toBe(properties)
    properties.value = '全屏下修改的正文'
    properties.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(JSON.stringify(instance.value.document)).toContain('全屏下修改的正文')
    expect(dialog.querySelector('.lingui-renderer-host')).toBe(host)
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    await flushPromises()
    expect(view.get('.lu-properties textarea').element).toBe(properties)
    expect(view.get('.lingui-renderer-host').element).toBe(host)
    expect(document.activeElement).toBe(trigger.element)
  })
  it('moves the same renderer into a modal and retains interactions through Esc and focus restoration', async () => {
    const host = render(),
      trigger = document.querySelector<HTMLButtonElement>('[data-preview-fullscreen]')!
    const input = host.shadowRoot!.querySelector<HTMLInputElement>('input[type=checkbox]')!
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    trigger.focus()
    trigger.click()
    await flushPromises()
    const dialog = document.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(dialog.querySelector('.lingui-renderer-host')).toBe(host)
    expect(host.shadowRoot!.querySelector('input')).toBe(input)
    expect(input.checked).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    await flushPromises()
    expect(dialog.open).toBe(false)
    expect(view!.find('.lingui-renderer-host').element).toBe(host)
    expect(input.checked).toBe(true)
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })
  it('restores body scroll when the workspace unmounts in fullscreen', async () => {
    document.body.style.overflow = 'auto'
    render()
    document.querySelector<HTMLButtonElement>('[data-preview-fullscreen]')!.click()
    await flushPromises()
    view!.unmount()
    view = undefined
    expect(document.body.style.overflow).toBe('auto')
    expect(document.querySelector('dialog')).toBeNull()
  })
})
