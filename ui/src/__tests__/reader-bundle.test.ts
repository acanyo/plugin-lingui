import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TextDecoder, TextEncoder } from 'node:util'
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { apiExamples, createInstance, examples } from '@lingui/renderer'

function page(instance = createInstance(examples[0]!.create())) {
  const dom = new JSDOM('<!doctype html><body></body>', {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only',
  })
  const api = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'real',
              name: '接口调用成功',
              summary: '无需额外启用 API',
              views: 42,
              displayViews: '42',
            },
          ],
        }),
      ),
  )
  const read = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ document: instance.document, theme: instance.theme, revision: 1 }),
      ),
  )
  const request = vi.fn((url) => (String(url).startsWith('/apis/') ? read() : api()))
  Object.assign(dom.window, { TextEncoder, TextDecoder, Headers, fetch: request, AbortController })
  dom.window.eval(readFileSync(resolve('build/reader/lingui-reader.js'), 'utf8'))
  function add(autoStart = true) {
    const element = dom.window.document.createElement('lingui-component') as HTMLElement & {
      interactions: { autoStart: boolean }
    }
    element.interactions = { autoStart }
    element.setAttribute('data-lingui', 'component-weather')
    dom.window.document.body.append(element)
    return element
  }
  return { dom, api, read, add }
}

describe('standalone production reader', () => {
  it('loads a referenced API component automatically and allows the host to suppress startup only', async () => {
    const definition = apiExamples.find((example) => example.id === 'api-metrics')!.create()
    definition.integrations!.apis[0]!.url = 'https://api.example.com/stats'
    const { dom, api, add } = page(createInstance(definition))
    try {
      const active = add()
      await vi.waitFor(() => expect(active.shadowRoot!.textContent).toContain('接口调用成功'))
      expect(api).toHaveBeenCalledTimes(1)
      const passive = add(false)
      await vi.waitFor(() =>
        expect(passive.shadowRoot!.querySelector('.lingui-surface')).not.toBeNull(),
      )
      expect(api).toHaveBeenCalledTimes(1)
      passive.shadowRoot!.querySelector<HTMLButtonElement>('[data-lingui-node="load"]')!.click()
      await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2))
    } finally {
      dom.window.close()
    }
  })
  it('runs without Node globals and only fetches a component when its tag is mounted', async () => {
    const { dom, api, read, add } = page()
    try {
      expect('process' in dom.window).toBe(false)
      expect(read).not.toHaveBeenCalled()
      const element = add()
      await vi.waitFor(() =>
        expect(element.shadowRoot?.querySelector('.lingui-surface')).not.toBeNull(),
      )
      expect(read).toHaveBeenCalledTimes(1)
      expect(api).not.toHaveBeenCalled()
    } finally {
      dom.window.close()
    }
  })
  it('calls a configured API by manual refresh without a registered host adapter', async () => {
    const definition = apiExamples.find((example) => example.id === 'api-search')!.create()
    definition.integrations!.apis[0]!.url = 'https://api.example.com/articles'
    const { dom, api, add } = page(createInstance(definition))
    try {
      const element = add()
      await vi.waitFor(() =>
        expect(element.shadowRoot!.querySelector('.lingui-surface')).not.toBeNull(),
      )
      expect(api).not.toHaveBeenCalled()
      element.shadowRoot!.querySelector<HTMLButtonElement>('[data-lingui-node="load"]')!.click()
      await vi.waitFor(() => expect(element.shadowRoot!.textContent).toContain('接口调用成功'))
      expect(api).toHaveBeenCalledTimes(1)
      expect(element.shadowRoot!.querySelector('.lg-error')).toBeNull()
    } finally {
      dom.window.close()
    }
  })
})
