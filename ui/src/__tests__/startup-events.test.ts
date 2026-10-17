import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  createInstance,
  mountRenderer,
  renderStatic,
  type ComponentNode,
  type EventBinding,
  type EventReport,
  type InteractionHost,
  type RendererHandle,
} from '@lingui/renderer'
import { column, document, text } from '../../../packages/renderer/src/examples/builders'
import LinguiRenderer from '../shared/LinguiRenderer.vue'

const handles: RendererHandle[] = []
afterEach(async () => {
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  vi.unstubAllGlobals()
  window.document.body.replaceChildren()
})

function weather(refresh = false, automatic = true) {
  const load: EventBinding = {
    actions: [{ type: 'api', name: 'weather', args: {} }],
    resultPath: '/response',
    loadingPath: '/loading',
    errorPath: '/error',
    concurrency: 'drop',
  }
  const nodes: ComponentNode[] = [
    {
      ...column('root', ['summary', ...(refresh ? ['refresh'] : [])]),
      ...(automatic ? { events: { mount: load } } : {}),
    },
    text('summary', { path: '/response/summary' }),
  ]
  if (refresh)
    nodes.push(
      {
        id: 'refresh',
        component: 'Button',
        child: 'refreshLabel',
        loading: { path: '/loading' },
        events: { click: load },
      },
      text('refreshLabel', '刷新天气'),
    )
  return createInstance({
    ...document('天气', nodes, { response: { summary: '' }, loading: false, error: '' }),
    integrations: {
      apis: [
        {
          name: 'weather',
          label: '天气',
          method: 'GET',
          url: 'https://api.example.com/weather?city=beijing',
        },
      ],
      callbacks: [],
    },
  })
}
function render(instance = weather(), interactions: InteractionHost = {}) {
  const host = window.document.createElement('div')
  window.document.body.append(host)
  const handle = mountRenderer(host, instance, interactions)
  handles.push(handle)
  return { handle, root: host.shadowRoot! }
}
const success = () => new Response(JSON.stringify({ summary: '北京 · 24°C' }))

describe('work startup requests', () => {
  it('loads once without a button and does not reload on response, theme or host updates', async () => {
    const request = vi.fn(async () => success())
    vi.stubGlobal('fetch', request)
    const instance = weather()
    const { root, handle } = render(instance)
    await vi.waitFor(() => expect(root.textContent).toContain('北京 · 24°C'))
    expect(root.querySelector('button')).toBeNull()
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'https://api.example.com/weather?city=beijing',
      expect.objectContaining({ method: 'GET', credentials: 'omit' }),
    )
    handle.update({ ...instance, theme: { ...instance.theme, radius: 12 } })
    handle.setInteractions({ trace: true })
    window.document.documentElement.classList.add('dark')
    await flushPromises()
    window.document.documentElement.classList.remove('dark')
    expect(request).toHaveBeenCalledTimes(1)
    // A new document creates a fresh work session.
    handle.update({ ...instance, document: { ...instance.document, title: '新的天气作品' } })
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  })

  it('loads on open, disables refresh while loading and makes one more request on refresh', async () => {
    let finish!: (response: Response) => void
    const request = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    vi.stubGlobal('fetch', request)
    const { root } = render(weather(true))
    const button = root.querySelector<HTMLButtonElement>('button')!
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(button.disabled).toBe(true)
    button.click()
    expect(request).toHaveBeenCalledTimes(1)
    finish(success())
    await vi.waitFor(() => expect(button.disabled).toBe(false))
    button.click()
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    finish(success())
    await vi.waitFor(() => expect(button.disabled).toBe(false))
  })

  it('keeps existing manual requests manual', async () => {
    const request = vi.fn(async () => success())
    vi.stubGlobal('fetch', request)
    const { root } = render(weather(true, false))
    await flushPromises()
    expect(request).not.toHaveBeenCalled()
    root.querySelector<HTMLButtonElement>('button')!.click()
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  })

  it('reports an automatic failure, clears loading and lets an explicit refresh retry', async () => {
    const reports: EventReport[] = []
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockImplementation(async () => success())
    vi.stubGlobal('fetch', request)
    const { root } = render(weather(true), { trace: true, onEvent: (event) => reports.push(event) })
    await vi.waitFor(() =>
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('HTTP 503'),
    )
    expect(request).toHaveBeenCalledTimes(1)
    const refresh = root.querySelector<HTMLButtonElement>('[data-lingui-node="refresh"]')!
    expect(refresh.disabled).toBe(false)
    expect(reports).toContainEqual(
      expect.objectContaining({
        event: 'mount',
        phase: 'error',
        stateChanges: expect.arrayContaining([
          expect.objectContaining({ path: '/error', after: expect.stringContaining('HTTP 503') }),
        ]),
      }),
    )
    refresh.click()
    await vi.waitFor(() => expect(root.textContent).toContain('北京 · 24°C'))
    expect(root.querySelector('[role="alert"]')).toBeNull()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('aborts an in-flight automatic request on removal and never reports late success', async () => {
    let signal: AbortSignal | undefined
    let finish!: (response: Response) => void
    const reports: EventReport[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init: RequestInit) => {
        signal = init.signal!
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      }),
    )
    const { handle, root } = render(weather(), { onEvent: (event) => reports.push(event) })
    await vi.waitFor(() => expect(signal).toBeDefined())
    await handle.destroy()
    handles.splice(handles.indexOf(handle), 1)
    expect(signal!.aborted).toBe(true)
    finish(success())
    await flushPromises()
    expect(reports).not.toContainEqual(
      expect.objectContaining({ phase: 'success', event: 'mount' }),
    )
    expect(root.querySelector('.lingui-surface')).toBeNull()
  })

  it('suppresses startup in snapshots without disabling explicit clicks', async () => {
    const request = vi.fn(async () => success())
    vi.stubGlobal('fetch', request)
    const instance = weather(true)
    const { root } = render(instance, { autoStart: false })
    const html = await renderStatic(instance)
    expect(html).toContain('刷新天气')
    await flushPromises()
    expect(request).not.toHaveBeenCalled()
    root.querySelector<HTMLButtonElement>('button')!.click()
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  })

  it('starts in the Vue workbench by default and honors the passive preview prop', async () => {
    const request = vi.fn(async () => success())
    vi.stubGlobal('fetch', request)
    const instance = weather()
    const active = mount(LinguiRenderer, { props: { instance }, attachTo: window.document.body })
    const passive = mount(LinguiRenderer, {
      props: { instance, autoStart: false },
      attachTo: window.document.body,
    })
    try {
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
      const activeRoot = active.get('.lingui-renderer-host').element.shadowRoot!
      await vi.waitFor(() => expect(activeRoot.textContent).toContain('北京 · 24°C'))
      expect(passive.get('.lingui-renderer-host').element.shadowRoot!.textContent).not.toContain(
        '北京 · 24°C',
      )
    } finally {
      active.unmount()
      passive.unmount()
    }
  })
})
