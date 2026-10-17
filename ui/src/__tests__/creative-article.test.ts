import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from '@halo-dev/components'
import {
  Editor,
  ExtensionDocument,
  ExtensionParagraph,
  ExtensionText,
  ExtensionHistory,
} from '@halo-dev/richtext-editor'
import { createInstance } from '@lingui/renderer'
import { LinguiNode } from '../editor-extension/LinguiNode'
import { createBlankDocument } from '../component-studio/document-editor'
import {
  captureArticleSource,
  transformPrompt,
  articleChanged,
  type TransformKind,
} from '../article-transform/source'
import { insertArticleTransform } from '../article-transform/insertion'
import { resumeSnapshot } from '../creation-history/types'
let editor: Editor
function setup() {
  editor = new Editor({
    extensions: [
      ExtensionDocument,
      ExtensionParagraph,
      ExtensionText,
      ExtensionHistory,
      LinguiNode,
    ],
    content: '<p>JVM 堆存储对象，线程共享。</p><p>栈保存局部变量，线程私有。</p>',
  })
  editor.commands.setTextSelection({ from: 1, to: 15 })
  return captureArticleSource(editor)
}
afterEach(() => {
  editor?.destroy()
  vi.restoreAllMocks()
})
describe('article selection to interactive content', () => {
  it('passes only the selected text and author-supplied context, bounds the request, and makes insufficient information and inference explicit', () => {
    const source = setup()
    for (const kind of ['quiz', 'flow', 'comparison'] as TransformKind[]) {
      const prompt = transformPrompt(source, kind)
      expect(prompt).toContain(source.text)
      expect(prompt).not.toContain('栈保存局部变量')
      expect(prompt).toContain('原文信息不足')
      expect(prompt).toContain('补充推断')
      expect(prompt.length).toBeLessThan(4000)
    }
    expect(source.fingerprint.length).toBeLessThan(100)
    expect(() => transformPrompt({ ...source, context: 'x'.repeat(3000) }, 'quiz')).toThrow('3000')
    editor.commands.setTextSelection(1)
    expect(() => captureArticleSource(editor)).toThrow('选中')
  })
  it('inserts a serializable block after the selected paragraph without replacing its original words and supports undo/reopen', async () => {
    const source = setup(),
      before = editor.getText(),
      instance = { ...createInstance(createBlankDocument()), templateId: 'component-article' }
    await insertArticleTransform(editor, source, instance)
    expect(editor.getText()).toContain('JVM 堆存储对象，线程共享。')
    expect(editor.getText()).toContain('栈保存局部变量，线程私有。')
    const content = editor.getJSON().content!
    expect(content.map((item) => item.type)).toEqual(['paragraph', 'linguiComponent', 'paragraph'])
    const html = editor.getHTML()
    expect(html).toContain('lingui-component')
    const reopened = new Editor({
      extensions: [ExtensionDocument, ExtensionParagraph, ExtensionText, LinguiNode],
      content: html,
    })
    expect(reopened.getJSON().content![1]!.attrs!.componentId).toBe(content[1]!.attrs!.componentId)
    reopened.destroy()
    editor.commands.undo()
    expect(editor.getText()).toBe(before)
    expect(editor.getJSON().content?.some((node) => node.type === 'linguiComponent')).toBe(false)
  })
  it('requires reconfirmation after article changes; cancellation and changes during confirmation leave content untouched', async () => {
    const source = setup(),
      instance = { ...createInstance(createBlankDocument()), templateId: 'component-article' }
    editor.commands.insertContentAt(2, '补充')
    expect(articleChanged(editor, source)).toBe(true)
    const before = editor.getHTML()
    vi.spyOn(Dialog, 'warning').mockImplementation((options) => {
      options?.onCancel?.()
      return undefined as never
    })
    await expect(insertArticleTransform(editor, source, instance)).rejects.toThrow('取消')
    expect(editor.getHTML()).toBe(before)
    vi.mocked(Dialog.warning).mockImplementation((options) => {
      editor.commands.insertContentAt(3, '又变更')
      options?.onConfirm?.()
      return undefined as never
    })
    await expect(insertArticleTransform(editor, source, instance)).rejects.toThrow('再次变化')
    expect(editor.getHTML()).not.toContain('lingui-component')
  })
  it('can confirm the new insertion location and keeps source references in local history only', async () => {
    const source = setup(),
      instance = { ...createInstance(createBlankDocument()), templateId: 'component-article' }
    editor.commands.insertContentAt(2, '补充')
    editor.commands.setTextSelection(editor.state.doc.content.size - 2)
    vi.spyOn(Dialog, 'warning').mockImplementation((options) => {
      options?.onConfirm?.()
      return undefined as never
    })
    await insertArticleTransform(editor, source, instance)
    expect(editor.getJSON().content?.at(-1)?.type).toBe('linguiComponent')
    const snapshot = resumeSnapshot({
      messages: [],
      instruction: transformPrompt(source, 'quiz'),
      dirty: true,
      editing: false,
      articleSource: source,
      instance,
    })
    expect(snapshot.articleSource).toEqual(source)
    expect(instance).not.toHaveProperty('articleSource')
  })
})
