import type { ArticleSource } from '../article-transform/source'
import { createApp, h, render, type AppContext } from 'vue'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import type { ComponentInstance } from '@lingui/renderer'
import StudioDialog from './StudioDialog.vue'
import type { Editor } from '@halo-dev/richtext-editor'
let closeActive: (() => void) | undefined
export function openStudio(
  editor: Editor,
  insert: (instance: ComponentInstance, source?: ArticleSource) => Promise<void>,
  instance?: ComponentInstance,
  context?: AppContext,
  article?: { source: ArticleSource; prompt: string },
): void {
  closeActive?.()
  const container = document.createElement('div')
  document.body.appendChild(container)
  let cleanup: () => void
  const props = {
    instance,
    article,
    onClose: () => cleanup(),
    apply: async (value: ComponentInstance, source?: ArticleSource) => {
      if (editor.isDestroyed) throw new Error('文章编辑器已关闭')
      await insert(value, source)
      cleanup()
    },
  }
  if (context) {
    const vnode = h(StudioDialog, props)
    vnode.appContext = context
    cleanup = () => {
      render(null, container)
      container.remove()
      if (closeActive === cleanup) closeActive = undefined
    }
    render(vnode, container)
  } else {
    const app = createApp(StudioDialog, props).use(formkit, defaultConfig())
    cleanup = () => {
      app.unmount()
      container.remove()
      if (closeActive === cleanup) closeActive = undefined
    }
    app.mount(container)
  }
  closeActive = cleanup
}
