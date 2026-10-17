import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TextDecoder, TextEncoder } from 'node:util'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiExamples, createInstance } from '@lingui/renderer'
import {
  button,
  column,
  document as definition,
  text,
} from '../../../packages/renderer/src/examples/builders'

let dom: JSDOM
afterEach(() => dom?.window.close())
function work(title = '主题计数器') {
  return createInstance(
    definition(
      title,
      [
        column('root', ['count', 'add']),
        text('count', { path: '/count' }),
        button('add', 'label', [{ type: 'increment', path: '/count' }]),
        text('label', '加一'),
      ],
      { count: 0 },
    ),
  )
}
function response(instance = work(), revision = 1) {
  return new Response(
    JSON.stringify({ document: instance.document, theme: instance.theme, revision }),
  )
}
function page(fetch: ReturnType<typeof vi.fn>, html = '') {
  dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only',
  })
  Object.assign(dom.window, { TextEncoder, TextDecoder, Headers, fetch, AbortController })
  dom.window.eval(readFileSync(resolve('build/reader/lingui-reader.js'), 'utf8'))
  return dom.window.document
}
function add(name = 'weather') {
  const element = dom.window.document.createElement('lingui-component')
  element.setAttribute('data-lingui', name)
  dom.window.document.body.append(element)
  return element
}

describe('short component references in themes', () => {
  it('upgrades existing short tags once, omits Halo credentials and isolates each instance', async () => {
    const request = vi.fn(async () => response())
    const doc = page(
      request,
      '<aside><lingui-component data-lingui="weather"></lingui-component></aside><footer><lingui-component data-lingui="weather"></lingui-component></footer>',
    )
    const elements = [...doc.querySelectorAll('lingui-component')]
    await vi.waitFor(() =>
      expect(
        elements[0]!.shadowRoot!.querySelector('[data-lingui-node="count"]')?.textContent,
      ).toBe('0'),
    )
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(
      '/apis/api.lingui.acanyo.com/v1alpha1/componentembeds/weather',
      expect.objectContaining({
        credentials: 'omit',
        mode: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      }),
    )
    elements[0]!.shadowRoot!.querySelector<HTMLButtonElement>('[data-lingui-node="add"]')!.click()
    await vi.waitFor(() =>
      expect(
        elements[0]!.shadowRoot!.querySelector('[data-lingui-node="count"]')!.textContent,
      ).toBe('1'),
    )
    expect(elements[1]!.shadowRoot!.querySelector('[data-lingui-node="count"]')!.textContent).toBe(
      '0',
    )
  })

  it('shows a useful public-access error and reloads the current saved version on retry', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockImplementation(async () => response(work('新版本内容'), 2))
    page(request)
    const element = add()
    await vi.waitFor(() =>
      expect(element.shadowRoot!.textContent).toContain('组件不存在或未开启公开嵌入'),
    )
    element.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click()
    await vi.waitFor(() =>
      expect(element.shadowRoot!.querySelector('.lingui-surface')?.getAttribute('aria-label')).toBe(
        '新版本内容',
      ),
    )
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('cancels a previous ID and ignores its late response after switching to another project', async () => {
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    const request = vi
      .fn()
      .mockImplementationOnce((_url, options) => {
        signal = options.signal
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      })
      .mockImplementation(async () => response(work('新项目')))
    page(request)
    const element = add('first')
    element.setAttribute('data-lingui', 'second')
    await vi.waitFor(() =>
      expect(element.shadowRoot!.querySelector('.lingui-surface')?.getAttribute('aria-label')).toBe(
        '新项目',
      ),
    )
    expect(signal.aborted).toBe(true)
    finish(response(work('过期项目')))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(element.shadowRoot!.querySelector('.lingui-surface')!.getAttribute('aria-label')).toBe(
      '新项目',
    )
  })

  it('never mounts a removed reference and rejects inline JSON', async () => {
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    const request = vi.fn((_url, options) => {
      signal = options.signal
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    })
    page(request)
    const element = add()
    element.remove()
    expect(signal.aborted).toBe(true)
    finish(response())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(element.shadowRoot!.querySelector('.lingui-surface')).toBeNull()
    const inline = add(JSON.stringify(work()))
    expect(inline.shadowRoot!.querySelector('.lingui-surface')).toBeNull()
    expect(inline.shadowRoot!.textContent).toContain('组件 ID 无效')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('keeps a shared request alive for remaining consumers and fetches fresh data after completion', async () => {
    let finish!: (value: Response) => void
    let signal!: AbortSignal
    const request = vi.fn((_url, options) => {
      signal = options.signal
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    })
    page(request)
    const first = add(),
      second = add()
    expect(request).toHaveBeenCalledTimes(1)
    first.remove()
    expect(signal.aborted).toBe(false)
    finish(response(work('仍可读取'), 1))
    await vi.waitFor(() =>
      expect(second.shadowRoot!.querySelector('.lingui-surface')?.getAttribute('aria-label')).toBe(
        '仍可读取',
      ),
    )
    request.mockImplementation(async () => response(work('最新内容'), 2))
    const third = add()
    await vi.waitFor(() =>
      expect(third.shadowRoot!.querySelector('.lingui-surface')?.getAttribute('aria-label')).toBe(
        '最新内容',
      ),
    )
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('runs the referenced component startup API once and retains manual refresh', async () => {
    const document = apiExamples.find((example) => example.id === 'api-metrics')!.create()
    document.integrations!.apis[0]!.url = 'https://api.example.com/stats'
    const instance = createInstance(document)
    const request = vi.fn(async (url) =>
      String(url).startsWith('/apis/')
        ? response(instance)
        : new Response(
            JSON.stringify({ items: [{ name: '主题实时数据', views: 42, displayViews: '42' }] }),
          ),
    )
    page(request)
    const element = add()
    await vi.waitFor(() => expect(element.shadowRoot!.textContent).toContain('主题实时数据'))
    expect(request).toHaveBeenCalledTimes(2)
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-lingui-node="load"]')!.click()
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3))
  })
})
