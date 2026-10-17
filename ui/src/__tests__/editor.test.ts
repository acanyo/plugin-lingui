import { describe, expect, it } from 'vitest'
import {
  Editor,
  ExtensionDocument,
  ExtensionParagraph,
  ExtensionText,
} from '@halo-dev/richtext-editor'
import { createInstance, examples } from '@lingui/renderer'
import { LinguiNode } from '../editor-extension/LinguiNode'
import { nodeAttributes } from '../editor-extension/serialization'

const extensions = [ExtensionDocument, ExtensionParagraph, ExtensionText, LinguiNode]
describe('Halo article component references', () => {
  it('round trips only the project ID through HTML and editor JSON', () => {
    const instance = { ...createInstance(examples[0]!.create()), templateId: 'component-weather' }
    const attrs = nodeAttributes(instance)
    const editor = new Editor({
      extensions,
      content: { type: 'doc', content: [{ type: 'linguiComponent', attrs }] },
    })
    const html = editor.getHTML()
    expect(html).toBe('<lingui-component data-lingui="component-weather"></lingui-component>')
    const reopened = new Editor({ extensions, content: html })
    expect(reopened.getJSON().content![0]!.attrs).toEqual({ componentId: 'component-weather' })
    expect(html).not.toContain(instance.document.title)
    editor.destroy()
    reopened.destroy()
  })
  it('requires a saved project and refuses inline JSON as a component reference', () => {
    expect(() => nodeAttributes(createInstance(examples[0]!.create()))).toThrow('保存为项目')
    const editor = new Editor({
      extensions,
      content: '<lingui-component data-lingui="{}"><script>bad()</script></lingui-component>',
    })
    expect(editor.getJSON().content?.some((node) => node.type === 'linguiComponent')).toBe(false)
    editor.destroy()
  })
})
