import { Dialog } from '@halo-dev/components'
import type { Editor } from '@halo-dev/richtext-editor'
import type { ComponentInstance } from '@lingui/renderer'
import { nodeAttributes } from '../editor-extension/serialization'
import {
  articleChanged,
  articleFingerprint,
  insertionAfterSelection,
  type ArticleSource,
} from './source'
/** A cancelled or stale confirmation cannot mutate the editor. */
export async function insertArticleTransform(
  editor: Editor,
  source: ArticleSource,
  instance: ComponentInstance,
) {
  if (editor.isDestroyed) throw new Error('文章编辑器已关闭')
  const attrs = nodeAttributes(instance)
  if (editor.isDestroyed) throw new Error('文章编辑器已关闭')
  if (articleChanged(editor, source)) {
    const fingerprint = articleFingerprint(editor),
      position = editor.state.selection.to
    await new Promise<void>((resolve, reject) =>
      Dialog.warning({
        title: '文章已发生变化',
        description:
          '原选段位置可能已经改变。确认后将插入当前光标所在段落之后，原文保留。取消后可返回文章调整光标。',
        confirmText: '插入当前段落之后',
        cancelText: '返回选择位置',
        onConfirm: () => resolve(),
        onCancel: () => reject(new Error('已取消插入，工作台草稿已保留')),
      }),
    )
    if (
      editor.isDestroyed ||
      articleFingerprint(editor) !== fingerprint ||
      editor.state.selection.to !== position
    )
      throw new Error('文章或光标再次变化，请重新确认插入位置')
  } else editor.commands.setTextSelection({ from: source.from, to: source.to })
  const at = insertionAfterSelection(editor)
  if (!editor.chain().focus().insertContentAt(at, { type: 'linguiComponent', attrs }).run())
    throw new Error('互动块插入失败，原文保留')
}
