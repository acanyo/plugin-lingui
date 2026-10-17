import { afterEach, describe, expect, it } from 'vitest'
import { componentNames, createInstance, mountRenderer, parseSource, serializeSource, validateDocument, languageLibrary, type RendererHandle } from '@lingui/renderer'
import { createCatalogPreview } from '../component-studio/catalog-preview'
import { addNode, createBlankDocument, updateNode } from '../component-studio/document-editor'
const handles: RendererHandle[] = []
afterEach(async () => { await Promise.all(handles.splice(0).map((h) => h.destroy())); document.body.replaceChildren() })
describe('OpenUI native rendering and editable documents', () => {
  it('registers all 105 components with OpenUI', () => {
    expect(Object.keys(languageLibrary.components)).toHaveLength(105)
    for (const type of componentNames) expect(languageLibrary.components[type.replace('LingUI.', 'LingUI_')]).toBeDefined()
  })
  it.each(componentNames)('round trips %s through OpenUI Lang and renders it', (type) => {
    const instance = createCatalogPreview(type)
    expect(instance.document.schemaVersion).toBe('lingui.document/2')
    expect(instance.document).not.toHaveProperty('messages')
    const nodes = parseSource(instance.document.source)
    expect(nodes.some((n) => n.component === type)).toBe(true)
    expect(parseSource(serializeSource(nodes))).toEqual(nodes)
    const host = document.createElement('div'); document.body.append(host)
    handles.push(mountRenderer(host, instance))
    expect(host.shadowRoot?.querySelector('.lingui-surface')).not.toBeNull()
    expect(host.shadowRoot?.textContent).not.toContain('此组件暂时无法展示')
  })
  it('keeps manual structural and property editing in OpenUI', () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.ColorPicker')
    const nodes = parseSource(added.document.source)
    const field = nodes.find((node) => node.id === added.id)!
    const edited = updateNode(added.document, { ...field, label: '品牌色' })
    expect(parseSource(edited.source).find((node) => node.id === added.id)?.label).toBe('品牌色')
    expect(createInstance(edited).document).not.toHaveProperty('messages')
  })
  it('converts old custom documents once without modifying the input', () => {
    const old = { schemaVersion: 'lingui.document/1', title: '旧作品', parameters: [], messages: [
      { version: 'v0.9.1', createSurface: { surfaceId: 'main', catalogId: 'urn:lingui:catalog:1' } },
      { version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Text', text: '保留内容' }] } },
      { version: 'v0.9.1', updateDataModel: { surfaceId: 'main', value: { count: 3 } } },
    ] }
    const before = JSON.stringify(old), next = validateDocument(old)
    expect(next.schemaVersion).toBe('lingui.document/2'); expect(next.state).toEqual({ count: 3 })
    expect(next.source).toContain('保留内容'); expect(JSON.stringify(old)).toBe(before)
  })
  it.each([
    'root = Script({}, [])',
    'root = Column({"id":"root","children":["__proto__"]}, [child])\nchild = Text({"id":"__proto__","text":"x"}, [])',
    'root = Text({"id":"root","text":"x"}, [constructor])\nconstructor = Text({"id":"safe","text":"x"}, [])',
    'root = Text({"id":"root","text":"x","text":"duplicate"}, [])',
    'root = Text({"id":"root","text":{"path":"/a","path":"/b"}}, [])',
    'root = Text({"id":"root","text":"hello","html":"<script/>"}, [])',
    'root = Text({"id":"root","text":{"path":"/constructor/x"}}, [])',
    'root = Text({"id":"root","text":"x"}, [root])',
    'root = Text({"id":"root","text":"x"}, [missing])',
    'root = Text({"id":"root","text":"x"}, [])\nfetch("https://example.com")',
    'root = Text({"id":"root","text":{"__proto__":{"x":1}}}, [])',
  ])('rejects unsupported syntax, unsafe config and references: %s', (source) => {
    expect(() => validateDocument({ ...createBlankDocument(), source })).toThrow()
  })
})
