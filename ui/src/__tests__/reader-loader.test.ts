import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'

const loader = readFileSync(resolve('../src/main/resources/reader/lingui-loader.js'), 'utf8')
let dom: JSDOM
afterEach(() => dom?.window.close())
function page(html = '') {
  dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: 'https://example.com/post',
    runScripts: 'outside-only',
  })
  return dom.window.document
}
function runLoader(search = '') {
  const script = dom.window.document.createElement('script')
  script.src = `/plugins/plugin-lingui/assets/reader/lingui-loader.js${search}`
  dom.window.document.head.append(script)
  Object.defineProperty(dom.window.document, 'currentScript', { configurable: true, value: script })
  dom.window.eval(loader)
}
function readers() {
  return [...dom.window.document.scripts].filter((script) =>
    script.src.includes('/lingui-reader.js'),
  )
}

describe('theme reader loader', () => {
  it('loads once for existing components and preserves the plugin version', () => {
    page('<aside><lingui-component data-lingui="{}"></lingui-component></aside>')
    runLoader('?v=1.0.0-rc2')
    runLoader()
    runLoader('?v=another')
    expect(readers()).toHaveLength(1)
    expect(readers()[0]!.src).toBe(
      'https://example.com/plugins/plugin-lingui/assets/reader/lingui-reader.js?v=1.0.0-rc2',
    )
  })
  it('keeps pages without components light and loads after a dynamic theme widget is inserted', async () => {
    const doc = page('<footer></footer>')
    runLoader()
    runLoader()
    doc.body.append(doc.createElement('p'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(readers()).toHaveLength(0)
    doc.querySelector('footer')!.innerHTML =
      '<lingui-component data-lingui="{}"></lingui-component>'
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(readers()).toHaveLength(1)
    doc.body.append(doc.createElement('lingui-component'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(readers()).toHaveLength(1)
  })
  it('detects an existing tag whose data is attached later', async () => {
    const doc = page('<lingui-component></lingui-component>')
    runLoader()
    expect(readers()).toHaveLength(0)
    doc.querySelector('lingui-component')!.setAttribute('data-lingui', '{}')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(readers()).toHaveLength(1)
  })
  it('reuses an already loaded custom element and an in-flight reader from another snippet', () => {
    const doc = page('<lingui-component data-lingui="{}"></lingui-component>')
    const runtime = doc.createElement('script')
    runtime.src = '/plugins/plugin-lingui/assets/reader/lingui-reader.js?v=old'
    doc.head.append(runtime)
    runLoader('?v=new')
    expect(readers()).toEqual([runtime])
    runtime.remove()
    doc.querySelectorAll('[data-lingui-loader-active]').forEach((script) => script.remove())
    dom.window.customElements.define('lingui-component', class extends dom.window.HTMLElement {})
    runLoader()
    expect(readers()).toHaveLength(0)
  })
  it('allows a fresh loader to retry a failed runtime download', () => {
    page('<lingui-component data-lingui="{}"></lingui-component>')
    runLoader()
    const failed = readers()[0]!
    failed.dispatchEvent(new dom.window.Event('error'))
    expect(failed.isConnected).toBe(false)
    runLoader()
    expect(readers()).toHaveLength(1)
    expect(readers()[0]).not.toBe(failed)
  })
})
