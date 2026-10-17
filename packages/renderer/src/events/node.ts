import type { Binding, ComponentNode, JsonValue } from '../protocol/types'
import { useRenderer } from '../renderer-core/context'
export function useNodeEvents(getNode: () => ComponentNode) {
  const { runtime, events } = useRenderer()
  return {
    emit: (event: Parameters<typeof events.fire>[1], data: JsonValue = null) => {
      void events.fire(getNode(), event, data)
    },
    set: (binding: Binding, value: JsonValue) => {
      const previousValue = runtime.resolve(binding) ?? null
      runtime.set(binding, value)
      if (JSON.stringify(previousValue) !== JSON.stringify(value))
        void events.fire(getNode(), 'change', { value, previousValue, path: binding.path })
    },
  }
}
