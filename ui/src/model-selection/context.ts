import { inject, onScopeDispose, watch, type InjectionKey, type Ref } from 'vue'
import type { ModelSelection } from './useModelSelection'

export const modelSelectionKey: InjectionKey<ModelSelection> = Symbol('LingUI model selection')
export const useWorkbenchModelSelection = () => inject(modelSelectionKey, undefined)

/** Keep the shared selection fixed throughout a generation, including checks and repair rounds. */
export function useModelSelectionActivity(busy: Readonly<Ref<boolean>>) {
  const selection = useWorkbenchModelSelection()
  let release: (() => void) | undefined
  watch(
    busy,
    (value) => {
      release?.()
      release = value ? selection?.acquire() : undefined
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => release?.())
}
