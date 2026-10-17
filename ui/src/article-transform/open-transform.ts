import { h, render, type AppContext } from 'vue'
import { Toast } from '@halo-dev/components'
import type { Editor } from '@halo-dev/richtext-editor'
import ArticleTransformDialog from './ArticleTransformDialog.vue'
import { captureArticleSource, type ArticleSource } from './source'
import { openStudio } from '../editor-extension/open-studio'
import { insertArticleTransform } from './insertion'

export function openArticleTransform(editor: Editor, context?: AppContext) {
  let initial: ArticleSource
  try {
    initial = captureArticleSource(editor)
  } catch (cause) {
    Toast.info(cause instanceof Error ? cause.message : '请先选择原文')
    return
  }
  const container = document.createElement('div')
  document.body.append(container)
  const close = () => {
    render(null, container)
    container.remove()
  }
  const vnode = h(ArticleTransformDialog, {
    source: initial,
    onClose: close,
    onCreate: (source: ArticleSource, prompt: string) => {
      close()
      openStudio(
        editor,
        (instance, currentSource) => {
          if (!currentSource)
            throw new Error('当前草稿未关联文章选段，请恢复对应的创作记录后再插入')
          return insertArticleTransform(editor, currentSource, instance)
        },
        undefined,
        context,
        { source, prompt },
      )
    },
  })
  if (context) vnode.appContext = context
  render(vnode, container)
}
