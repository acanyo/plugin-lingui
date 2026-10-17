import type { ComponentInstance } from '../protocol/types'
import type { InteractionHost } from '../events/types'
export function createRendererProps(
  instance: ComponentInstance,
  hostDark: boolean,
  interactions: InteractionHost = {},
) {
  const props = $state({ instance, hostDark, interactions })
  return props
}
