import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createInstance,
  mountRenderer,
  registerInteractionCallback,
  registerInteractionRequests,
  type ComponentNode,
  type RendererHandle,
  type InteractionHost,
  type EventReport,
} from '@lingui/renderer'
import { column, document, text } from '../../../packages/renderer/src/examples/builders'
const handles: RendererHandle[] = []
afterEach(async () => {
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  window.document.body.replaceChildren()
})
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
function render(nodes: ComponentNode[], state = {}, interactions: InteractionHost = {}) {
  const host = window.document.createElement('div')
  window.document.body.append(host)
  const handle = mountRenderer(
    host,
    createInstance(
      document(
        '事件预览',
        [
          column(
            'root',
            nodes.map((node) => node.id),
          ),
          ...nodes,
        ],
        state,
      ),
    ),
    interactions,
  )
  handles.push(handle)
  return { root: host.shadowRoot!, handle }
}
const callbackEvent = {
  actions: [{ type: 'callback' as const, name: 'observe', args: { $event: '/' } }],
}
describe('component events in the rendered UI', () => {
  it('forwards workbench diagnostics through the mounted Svelte renderer', async () => {
    const reports: EventReport[] = []
    const { root } = render(
      [
        {
          id: 'button',
          component: 'Button',
          child: 'label',
          events: { click: { actions: [{ type: 'callback', name: 'save' }] } },
        },
        text('label', '保存'),
      ],
      { value: '' },
      {
        trace: true,
        callbacks: {
          save: (_args, context) => {
            context.setState('/value', 'saved')
            return 'ok'
          },
        },
        onEvent: (report) => reports.push(report),
      },
    )
    root.querySelector('button')!.click()
    await settle()
    expect(reports.some((report) => report.scope === 'action' && report.phase === 'success')).toBe(
      true,
    )
    expect(reports.at(-1)?.stateChanges).toContainEqual({
      path: '/value',
      before: '',
      after: 'saved',
    })
  })
  it('lets menu items invoke a selection callback without a dummy state action', async () => {
    const observe = vi.fn()
    const { root } = render(
      [
        {
          id: 'menu',
          component: 'LingUI.Dropdown',
          label: '操作',
          menuItems: [{ id: 'send', label: '提交' }],
          events: { select: callbackEvent },
        },
      ],
      {},
      { callbacks: { observe } },
    )
    root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click()
    await settle()
    root.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click()
    await settle()
    expect(observe).toHaveBeenCalledTimes(1)
    expect(observe.mock.calls[0]![0]).toMatchObject({ id: 'send', index: 0 })
  })
  it('executes a button callback once, shows loading and preserves legacy state actions', async () => {
    let finish!: (value: unknown) => void
    const callback = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const reports: EventReport[] = []
    const { root } = render(
      [
        {
          id: 'button',
          component: 'Button',
          child: 'label',
          action: {
            functionCall: {
              call: 'lingui.dispatch',
              args: { actions: [{ type: 'increment', path: '/count' }] },
            },
          },
          events: { click: callbackEvent },
        },
        text('label', '保存'),
      ],
      { count: 0 },
      { callbacks: { observe: callback }, onEvent: (report) => reports.push(report) },
    )
    const button = root.querySelector('button')!
    button.click()
    await settle()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    button.click()
    await settle()
    expect(callback).toHaveBeenCalledTimes(1)
    finish({ saved: true })
    await settle()
    expect(button.disabled).toBe(false)
    expect(reports.at(-1)?.phase).toBe('success')
  })
  it('fires field input/change, change after selection, focus, search, and clear with fresh bound values', async () => {
    const calls: any[] = []
    const { root } = render(
      [
        {
          id: 'search',
          component: 'LingUI.SearchInput',
          label: '搜索',
          value: { path: '/query' },
          events: {
            input: callbackEvent,
            change: callbackEvent,
            focus: callbackEvent,
            search: callbackEvent,
            clear: callbackEvent,
          },
        },
      ],
      { query: '' },
      {
        callbacks: {
          observe: (args, context) => {
            calls.push({ event: context.event, args })
            return null
          },
        },
      },
    )
    const input = root.querySelector('input')!
    input.focus()
    await settle()
    input.value = '灵构'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await settle()
    expect(calls.find((call) => call.event === 'input').args.value).toBe('灵构')
    expect(calls.find((call) => call.event === 'change').args.previousValue).toBe('')
    expect(calls.some((call) => call.event === 'focus')).toBe(true)
    expect(calls.some((call) => call.event === 'search')).toBe(true)
    root.querySelector<HTMLButtonElement>('.lg-input-clear')!.click()
    await settle()
    expect(calls.find((call) => call.event === 'clear').args.value).toBe('')
  })
  it('fires semantic change for a custom select and confirmation without executing during preview mount', async () => {
    const calls: string[] = []
    const { root } = render(
      [
        {
          id: 'select',
          component: 'LingUI.Select',
          label: '分类',
          value: { path: '/choice' },
          options: [
            { label: '设计', value: 'design' },
            { label: '开发', value: 'dev' },
          ],
          events: { change: callbackEvent },
        },
        {
          id: 'confirm',
          component: 'LingUI.Popconfirm',
          label: '发布',
          text: '确认发布？',
          events: { confirm: callbackEvent, cancel: callbackEvent },
        },
      ],
      { choice: 'design' },
      {
        callbacks: {
          observe: (_args, context) => {
            calls.push(context.event)
            return null
          },
        },
      },
    )
    expect(calls).toEqual([])
    root.querySelector<HTMLButtonElement>('[role="combobox"]')!.click()
    await settle()
    Array.from(root.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.includes('开发'))!
      .click()
    await settle()
    expect(calls).toContain('change')
    root.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!.click()
    await settle()
    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === '确认')!
      .click()
    await settle()
    expect(calls).toContain('confirm')
  })
  it('submits a real form with component values and reports native validation errors', async () => {
    const calls: any[] = []
    const { root } = render(
      [
        {
          id: 'form',
          component: 'LingUI.FormGroup',
          label: '提交资料',
          child: 'fields',
          events: { submit: callbackEvent, invalid: callbackEvent },
        },
        column('fields', ['name', 'send']),
        {
          id: 'name',
          component: 'TextField',
          label: '名称',
          value: { path: '/name' },
          required: true,
        },
        { id: 'send', component: 'Button', child: 'sendLabel', buttonType: 'submit' },
        text('sendLabel', '提交'),
      ],
      { name: '' },
      {
        callbacks: {
          observe: (args, context) => {
            calls.push({ event: context.event, args })
            return null
          },
        },
      },
    )
    const input = root.querySelector('input')!
    root.querySelector<HTMLButtonElement>('button')!.click()
    await settle()
    expect(calls.some((call) => call.event === 'invalid')).toBe(true)
    expect(calls.some((call) => call.event === 'submit')).toBe(false)
    input.value = '小明'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await settle()
    expect(calls.find((call) => call.event === 'submit').args.values.name).toBe('小明')
  })
  it('isolates restricted previews from globally registered callbacks and API adapters', async () => {
    const observe = vi.fn(),
      request = vi.fn(),
      releases = [
        registerInteractionCallback('business', observe),
        registerInteractionRequests({ allow: () => true, fetch: request }),
      ]
    try {
      const { root } = render(
        [
          {
            id: 'callback',
            component: 'Button',
            child: 'label',
            events: { click: { actions: [{ type: 'callback', name: 'business' }] } },
          },
          {
            id: 'api',
            component: 'Button',
            child: 'label',
            events: { click: { actions: [{ type: 'request', url: 'https://example.com' }] } },
          },
          text('label', '测试'),
        ],
        {},
        { inheritRegistered: false, requests: { allow: () => false } },
      )
      root.querySelector<HTMLButtonElement>('[data-lingui-node="callback"]')!.click()
      await settle()
      root.querySelector<HTMLButtonElement>('[data-lingui-node="api"]')!.click()
      await settle()
      expect(observe).not.toHaveBeenCalled()
      expect(request).not.toHaveBeenCalled()
    } finally {
      releases.forEach((release) => release())
    }
  })
  it('registered JS callbacks can be used by an embedded component and released', async () => {
    const observe = vi.fn(async () => ({ ok: true })),
      release = registerInteractionCallback('testCallback', observe)
    try {
      const { root } = render([
        {
          id: 'button',
          component: 'Button',
          child: 'label',
          events: { click: { actions: [{ type: 'callback', name: 'testCallback' }] } },
        },
        text('label', '回调'),
      ])
      root.querySelector<HTMLButtonElement>('button')!.click()
      await settle()
      expect(observe).toHaveBeenCalledTimes(1)
    } finally {
      release()
    }
  })
})
