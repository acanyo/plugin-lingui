import type { ComponentInstance, ComponentNode } from '../protocol/types'
import type { EventAction } from '../events/types'
import type { IntegrationDefinitions } from './types'
import { parseSource, serializeSource } from '../openui/source'
import { validateInstance } from '../protocol/instance'
export interface WorkDependency {
  kind: 'api' | 'request' | 'callback'
  name: string
  label: string
  configured: boolean
  url?: string
  method?: string
}
export function eventActions(node: ComponentNode): EventAction[] {
  return Object.values(node.events ?? {}).flatMap((binding) => [
    ...binding.actions,
    ...(binding.onSuccess ?? []),
    ...(binding.onError ?? []),
  ])
}
/** Derived from actual handlers; a marketplace author cannot hide an undeclared dependency. */
export function workDependencies(instance: ComponentInstance): WorkDependency[] {
  const result = new Map<string, WorkDependency>()
  const definitions = instance.document.integrations
  for (const node of parseSource(instance.document.source))
    for (const action of eventActions(node)) {
      if (action.type === 'api') {
        const api = definitions?.apis.find((item) => item.name === action.name)
        result.set(`api:${action.name}`, {
          kind: 'api',
          name: action.name,
          label: api?.label ?? action.name,
          configured: !!api,
          url: api?.url,
          method: api?.method,
        })
      }
      if (action.type === 'request') {
        const name = `${action.method ?? 'GET'} ${action.url}`
        result.set(`request:${name}`, {
          kind: 'request',
          name,
          label: name,
          configured: true,
          url: action.url,
          method: action.method ?? 'GET',
        })
      }
      if (action.type === 'callback') {
        const callback = definitions?.callbacks.find((item) => item.name === action.name)
        result.set(`callback:${action.name}`, {
          kind: 'callback',
          name: action.name,
          label: callback?.label ?? action.name,
          configured: !!callback,
        })
      }
    }
  return [...result.values()]
}
/** API identifiers stay stable while their implementation changes; callbacks are renamed in all branches. */
export function mapWorkDependencies(
  instance: ComponentInstance,
  targets: IntegrationDefinitions,
  mapping: Record<string, string>,
): ComponentInstance {
  const copy = validateInstance(instance)
  const integrations = copy.document.integrations ?? { apis: [], callbacks: [] }
  const rewrite = (action: EventAction): EventAction => {
    const key =
      action.type === 'api' || action.type === 'callback'
        ? `${action.type}:${action.name}`
        : action.type === 'request'
          ? `request:${action.method ?? 'GET'} ${action.url}`
          : ''
    const choice = mapping[key]
    if (!choice) return action
    if (action.type === 'callback') {
      const target = targets.callbacks.find((item) => item.name === choice)
      if (!target) throw new Error('映射的回调不存在')
      if (!integrations.callbacks.some((item) => item.name === target.name))
        integrations.callbacks.push(target)
      return { ...action, name: target.name }
    }
    if (action.type === 'api' || action.type === 'request') {
      const target = targets.apis.find((item) => item.name === choice)
      if (!target) throw new Error('映射的接口不存在')
      if (action.type === 'api') {
        const original = integrations.apis.findIndex((item) => item.name === action.name)
        const replacement = { ...target, name: action.name }
        if (original < 0) integrations.apis.push(replacement)
        else integrations.apis[original] = replacement
        return action
      }
      if (target.method !== (action.method ?? 'GET'))
        throw new Error('直接请求只能映射到相同请求方法的接口')
      return { ...action, url: target.url }
    }
    return action
  }
  copy.document.source = serializeSource(
    parseSource(copy.document.source).map((node) => ({
      ...node,
      ...(node.events
        ? {
            events: Object.fromEntries(
              Object.entries(node.events).map(([name, binding]) => [
                name,
                {
                  ...binding,
                  actions: binding.actions.map(rewrite),
                  ...(binding.onSuccess ? { onSuccess: binding.onSuccess.map(rewrite) } : {}),
                  ...(binding.onError ? { onError: binding.onError.map(rewrite) } : {}),
                },
              ]),
            ),
          }
        : {}),
    })),
  )
  if (copy.document.integrations || Object.keys(mapping).length)
    copy.document.integrations = integrations
  return validateInstance(copy)
}
