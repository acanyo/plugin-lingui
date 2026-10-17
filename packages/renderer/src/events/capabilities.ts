import capabilities from '../../schemas/event-capabilities.json'
import type { ComponentName } from '../protocol/types'
import type { ComponentEventName } from './types'
export function supportedEvents(component: ComponentName): ComponentEventName[] {
  return [
    ...((capabilities as Partial<Record<ComponentName, ComponentEventName[]>>)[component] ?? []),
  ]
}
