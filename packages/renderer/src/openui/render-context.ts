import { getContext, setContext, type Snippet } from 'svelte'
import type { ElementNode } from '@openuidev/lang-core'
const key = Symbol('LingUI OpenUI children')
export function provideOpenuiChildren(content: unknown[], renderNode: Snippet<[unknown]>) {
  const nodes = new Map<string, unknown>()
  for (const item of content ?? []) {
    const element = item as ElementNode
    const config = element?.props?.config as { id?: string } | undefined
    if (config?.id) nodes.set(config.id, item)
  }
  setContext(key, { nodes, renderNode })
}
export function openuiChildren() {
  return getContext<{ nodes: Map<string, unknown>; renderNode: Snippet<[unknown]> }>(key)
}
