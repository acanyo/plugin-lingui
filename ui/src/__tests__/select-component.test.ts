import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  createInstance,
  mountRenderer,
  renderStatic,
  type ComponentNode,
  type RendererHandle,
} from '@lingui/renderer'
import {
  column,
  document as definition,
  text,
  dispatch,
} from '../../../packages/renderer/src/examples/builders'

const handles: RendererHandle[] = []
const picker: ComponentNode = {
  id: 'picker',
  component: 'LingUI.Select',
  label: '分类',
  placeholder: '请选择分类',
  value: { path: '/choice' },
  options: [
    { value: 'all', label: '全部' },
    { value: 'active', label: '进行中' },
    { value: 'done', label: '已完成' },
  ],
}
function fixture(node = picker, choice = 'all', grouped = false) {
  return createInstance(
    definition(
      '下拉菜单',
      [
        column('root', grouped ? ['group', 'result'] : ['picker', 'result']),
        ...(grouped
          ? [
              {
                id: 'group',
                component: 'LingUI.FormGroup',
                label: '只读分组',
                child: 'picker',
                disabled: true,
              } as ComponentNode,
            ]
          : []),
        node,
        text('result', { path: '/choice' }),
      ],
      { choice, locked: true },
    ),
  )
}
function render(node = picker, choice = 'all', grouped = false) {
  const host = document.createElement('div')
  document.body.append(host)
  const handle = mountRenderer(host, fixture(node, choice, grouped))
  handles.push(handle)
  const root = host.shadowRoot!
  const trigger = root.querySelector<HTMLButtonElement>('[role=combobox]')!
  const panel = root.querySelector<HTMLDivElement>('[role=listbox]')!
  const options = [...panel.querySelectorAll<HTMLButtonElement>('[role=option]')]
  return { host, root, handle, trigger, panel, options }
}
async function key(target: HTMLElement, value: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key: value,
    shiftKey,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  await flushPromises()
  return event
}
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  document.body.replaceChildren()
})

describe('themed single select', () => {
  it('opens with the current selection, binds a choice and allows clearing', async () => {
    const { root, trigger, panel, options } = render()
    expect(trigger.textContent?.trim()).toBe('全部')
    expect(panel.hidden).toBe(true)
    trigger.focus()
    trigger.click()
    await flushPromises()
    expect(panel.hidden).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(options[1]!.getAttribute('aria-selected')).toBe('true')
    options[3]!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('done')
    expect(trigger.textContent?.trim()).toBe('已完成')
    expect(panel.hidden).toBe(true)
    expect(root.activeElement).toBe(trigger)
    trigger.click()
    await flushPromises()
    options[0]!.click()
    await flushPromises()
    expect(trigger.textContent?.trim()).toBe('请选择分类')
    expect(root.querySelector('.lg-text')!.textContent).toBe('')
  })
  it('navigates without changing the value until Enter commits', async () => {
    const { root, trigger, panel, options } = render()
    trigger.focus()
    await key(trigger, 'ArrowDown')
    expect(panel.hidden).toBe(false)
    await key(trigger, 'ArrowDown')
    expect(trigger.getAttribute('aria-activedescendant')).toBe(options[2]!.id)
    expect(root.querySelector('.lg-text')!.textContent).toBe('all')
    await key(trigger, 'End')
    expect(trigger.getAttribute('aria-activedescendant')).toBe(options[3]!.id)
    await key(trigger, 'Home')
    expect(trigger.getAttribute('aria-activedescendant')).toBe(options[0]!.id)
    await key(trigger, 'ArrowUp')
    expect(trigger.getAttribute('aria-activedescendant')).toBe(options[0]!.id)
    await key(trigger, 'End')
    await key(trigger, 'Enter')
    expect(root.querySelector('.lg-text')!.textContent).toBe('done')
    expect(trigger.hasAttribute('aria-activedescendant')).toBe(false)
  })
  it('opens on Space, consumes both Escape phases and restores focus inside an outer dialog', async () => {
    const { host, root, trigger, panel } = render()
    const escaped: string[] = []
    for (const type of ['keydown', 'keyup'])
      host.addEventListener(type, (event) => {
        if ((event as KeyboardEvent).key === 'Escape') escaped.push(type)
      })
    trigger.focus()
    await key(trigger, ' ')
    expect(panel.hidden).toBe(false)
    expect((await key(trigger, 'Escape')).defaultPrevented).toBe(true)
    trigger.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, composed: true }),
    )
    expect(escaped).toEqual([])
    expect(root.activeElement).toBe(trigger)
    expect(trigger.textContent?.trim()).toBe('全部')
    await key(trigger, 'Escape')
    expect(escaped).toEqual(['keydown'])
  })
  it.each([false, true])(
    'dismisses with Tab (shift=%s) without preventing normal focus navigation',
    async (shift) => {
      const { trigger, panel } = render()
      trigger.click()
      await flushPromises()
      expect((await key(trigger, 'Tab', shift)).defaultPrevented).toBe(false)
      expect(panel.hidden).toBe(true)
    },
  )
  it('dismisses outside pointer and focus events without stealing focus', async () => {
    const { trigger, panel } = render()
    const outside = document.createElement('button')
    document.body.append(outside)
    trigger.click()
    await flushPromises()
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }))
    await flushPromises()
    expect(panel.hidden).toBe(true)
    trigger.click()
    await flushPromises()
    outside.focus()
    await flushPromises()
    expect(panel.hidden).toBe(true)
    expect(document.activeElement).toBe(outside)
  })
  it('finds labels by typing and cycles repeated initials', async () => {
    const node = {
      ...picker,
      options: [
        { value: 'alpha', label: 'Alpha' },
        { value: 'apricot', label: 'Apricot' },
        { value: 'beta', label: 'Beta' },
      ],
    }
    const { trigger, options, root } = render(node, 'alpha')
    await key(trigger, 'a')
    expect(trigger.getAttribute('aria-activedescendant')).toBe(options[2]!.id)
    await key(trigger, 'a')
    expect(trigger.getAttribute('aria-activedescendant')).toBe(options[1]!.id)
    await key(trigger, 'Enter')
    expect(root.querySelector('.lg-text')!.textContent).toBe('alpha')
    await key(trigger, 'b')
    await key(trigger, 'e')
    const later = Date.now() + 1000
    vi.spyOn(Date, 'now').mockReturnValue(later)
    await key(trigger, ' ')
    expect(root.querySelector('.lg-text')!.textContent).toBe('beta')
  })
  it.each(['binding', 'group'] as const)(
    'prevents opening and mutation when disabled by %s',
    async (source) => {
      const { root, trigger, panel, options } = render(
        source === 'binding' ? { ...picker, disabled: { path: '/locked' } } : picker,
        'all',
        source === 'group',
      )
      expect(trigger.disabled).toBe(true)
      trigger.click()
      await key(trigger, 'ArrowDown')
      options[3]!.click()
      await flushPromises()
      expect(panel.hidden).toBe(true)
      expect(root.querySelector('.lg-text')!.textContent).toBe('all')
    },
  )
  it('closes when disabled dynamically and shows a placeholder for an unavailable saved value', async () => {
    const { handle, root, trigger } = render(picker, 'removed')
    expect(trigger.textContent?.trim()).toBe('请选择分类')
    trigger.click()
    await flushPromises()
    handle.update(fixture({ ...picker, disabled: true }, 'removed'))
    await flushPromises()
    expect(root.querySelector<HTMLDivElement>('[role=listbox]')!.hidden).toBe(true)
    expect(root.querySelector<HTMLButtonElement>('[role=combobox]')!.disabled).toBe(true)
  })
  it('closes an open menu when a local action disables its binding', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    handles.push(
      mountRenderer(
        host,
        createInstance(
          definition(
            '绑定状态',
            [
              column('root', ['picker', 'lock']),
              { ...picker, disabled: { path: '/locked' } },
              {
                id: 'lock',
                component: 'Button',
                child: 'lock-label',
                action: dispatch({ type: 'setState', path: '/locked', value: true }),
              },
              text('lock-label', '锁定选择'),
            ],
            { choice: 'all', locked: false },
          ),
        ),
      ),
    )
    const root = host.shadowRoot!
    const trigger = root.querySelector<HTMLButtonElement>('[role=combobox]')!
    trigger.click()
    await flushPromises()
    expect(root.querySelector<HTMLDivElement>('[role=listbox]')!.hidden).toBe(false)
    root.querySelector<HTMLButtonElement>('.lg-button')!.click()
    await flushPromises()
    expect(root.querySelector<HTMLDivElement>('[role=listbox]')!.hidden).toBe(true)
    expect(trigger.disabled).toBe(true)
  })
  it('keeps ARIA targets and selection isolated between mounted instances', async () => {
    const first = render(),
      second = render()
    expect(first.trigger.getAttribute('aria-controls')).not.toBe(
      second.trigger.getAttribute('aria-controls'),
    )
    expect(first.trigger.getAttribute('aria-controls')).toBe(first.panel.id)
    first.trigger.click()
    await flushPromises()
    first.options[3]!.click()
    await flushPromises()
    expect(second.trigger.textContent?.trim()).toBe('全部')
  })
  it('keeps the saved selection readable offline without hidden choices or broken ARIA references', async () => {
    const fallback = document.createElement('div')
    fallback.innerHTML = await renderStatic(fixture(picker, 'done'))
    const trigger = fallback.querySelector<HTMLButtonElement>('.lg-select-trigger')!
    expect(trigger.textContent?.trim()).toBe('已完成')
    expect(trigger.disabled).toBe(true)
    expect(trigger.hasAttribute('aria-controls')).toBe(false)
    expect(trigger.hasAttribute('aria-expanded')).toBe(false)
    expect(fallback.querySelector('[role=listbox]')).toBeNull()
    expect(fallback.textContent).not.toContain('进行中')
  })
})
