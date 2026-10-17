import {
  childIds,
  evaluate,
  resolveCollectionNode,
  type ComponentNode,
  type Runtime,
} from '@lingui/renderer'
import type { CheckIssue } from './types'
/** Resolve visible computed values with the same expression and collection runtime as the preview. */
export function checkViewState(
  nodes: Record<string, ComponentNode>,
  runtime: Runtime,
): CheckIssue[] {
  const issues: CheckIssue[] = [],
    visited = new Set<string>()
  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const node = nodes[id]
    if (!node) return
    try {
      if (node.component === 'LingUI.Conditional' && !evaluate(node.condition!, runtime.state))
        return
      resolveCollectionNode(node, runtime.state)
      for (const key of [
        'text',
        'title',
        'description',
        'label',
        'value',
        'disabled',
        'loading',
        'tone',
        'url',
      ] as const)
        if (node[key] && typeof node[key] === 'object') runtime.resolve(node[key])
      for (const tab of node.tabs ?? []) runtime.resolve(tab.title)
      for (const child of childIds(node)) visit(child)
    } catch (cause) {
      issues.push({
        nodeId: id,
        level: 'error',
        message: cause instanceof Error ? cause.message : '状态计算失败',
      })
    }
  }
  visit('root')
  return issues
}
