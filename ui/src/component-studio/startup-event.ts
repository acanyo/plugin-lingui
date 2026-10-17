import type { ComponentEventName, ComponentNode, EventBinding } from '@lingui/renderer'

// Bindings are JSON; compare structure so imported property order does not unlink them.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`
  return JSON.stringify(value) ?? ''
}

export function startupMode(node: ComponentNode): 'none' | 'shared' | 'independent' {
  if (!node.events?.mount) return 'none'
  return node.events.click && canonical(node.events.click) === canonical(node.events.mount)
    ? 'shared'
    : 'independent'
}

export function updateEventBinding(
  node: ComponentNode,
  event: ComponentEventName,
  binding: EventBinding | null | undefined,
  autoStart: boolean,
): ComponentNode {
  const events = { ...node.events }
  if (binding) events[event] = binding
  else delete events[event]
  // A separately configured startup event belongs to its own editor.
  if (event === 'click' && binding && startupMode(node) !== 'independent') {
    if (autoStart) events.mount = JSON.parse(JSON.stringify(binding))
    else if (startupMode(node) === 'shared') delete events.mount
  }
  const next = { ...node, events }
  if (!Object.keys(events).length) delete (next as ComponentNode).events
  return next
}
