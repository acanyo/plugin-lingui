import { inject, onBeforeUnmount, ref } from 'vue'
import { Toast } from '@halo-dev/components'
import { errorMessage, useRepository } from '../services/repository'
import { createEmbedClient, embedClientKey } from './client'
import { componentReferenceHtml } from './html'

/** Cards only check publication on demand; browsing the grid performs no embed requests. */
export function useCopyEmbedCode(name: () => string, openDialog: () => void) {
  const repository = useRepository()
  const client = inject(embedClientKey, undefined) ?? createEmbedClient()
  const copying = ref(false)
  const copied = ref(false)
  const controller = new AbortController()
  let feedback: ReturnType<typeof setTimeout> | undefined
  onBeforeUnmount(() => {
    controller.abort()
    clearTimeout(feedback)
  })

  async function copy() {
    if (copying.value || controller.signal.aborted) return
    copied.value = false
    clearTimeout(feedback)
    if (repository.mode !== 'halo') {
      openDialog()
      return
    }
    copying.value = true
    try {
      const id = name()
      const code = componentReferenceHtml(id)
      const status = await client.status(id, controller.signal)
      if (controller.signal.aborted) return
      if (!status.enabled) {
        openDialog()
        return
      }
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
        await navigator.clipboard.writeText(code)
      } catch {
        if (!controller.signal.aborted) {
          openDialog()
          Toast.info('无法自动复制，请在弹窗中选择代码手动复制')
        }
        return
      }
      if (!controller.signal.aborted) {
        copied.value = true
        feedback = setTimeout(() => {
          copied.value = false
        }, 2000)
      }
    } catch (cause) {
      if (!controller.signal.aborted) Toast.error(errorMessage(cause))
    } finally {
      if (!controller.signal.aborted) copying.value = false
    }
  }
  return { copying, copied, copy }
}
