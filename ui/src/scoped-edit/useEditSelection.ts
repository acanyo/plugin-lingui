import { nextTick, ref, shallowRef, watch } from 'vue'
import type { ComponentInstance } from '@lingui/renderer'
import { targetInfo, type EditTarget } from './model'

export function useEditSelection(options: {
  current: () => ComponentInstance | undefined
  blocked: () => boolean
  showPreview: () => void
  showComposer: () => void
  focusComposer: () => void
}) {
  const selecting = ref(false)
  const editTarget = shallowRef<EditTarget>()
  function startSelecting() {
    if (!options.current() || options.blocked()) return
    selecting.value = true
    options.showPreview()
  }
  async function selectNode(id: string) {
    const instance = options.current()
    if (!instance || options.blocked()) return
    const target: EditTarget = { nodeId: id, scope: 'node' }
    try {
      targetInfo(instance.document, target)
    } catch {
      return
    }
    editTarget.value = target
    selecting.value = false
    options.showComposer()
    await nextTick()
    options.focusComposer()
  }
  watch(
    () => options.current()?.document,
    (document) => {
      if (!document) {
        selecting.value = false
        editTarget.value = undefined
        return
      }
      if (editTarget.value) {
        try {
          targetInfo(document, editTarget.value)
        } catch {
          editTarget.value = undefined
        }
      }
    },
  )
  watch(options.blocked, (blocked) => {
    if (blocked) selecting.value = false
  })
  function cancelSelection(event?: KeyboardEvent) {
    if (!selecting.value) return
    event?.preventDefault()
    event?.stopPropagation()
    selecting.value = false
  }
  return { selecting, editTarget, startSelecting, selectNode, cancelSelection }
}
