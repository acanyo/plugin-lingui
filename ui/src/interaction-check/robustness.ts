import {
  childIds,
  evaluate,
  readPath,
  type ComponentNode,
  type EventBinding,
  type JsonValue,
  type State,
} from '@lingui/renderer'
import type { CheckIssue } from './types'
import { dynamicPaths } from '../data-binding/dynamic-paths'

/** A request cannot start if its only prerequisite is the inverse of its own idle loading flag. */
export function disabledRequestIssue(
  node: ComponentNode,
  binding: EventBinding | undefined,
  state: State,
): CheckIssue | undefined {
  if (
    !binding?.loadingPath ||
    readPath(state, binding.loadingPath) !== false ||
    !binding.actions.some((action) => action.type === 'api' || action.type === 'request')
  )
    return
  const paths = dynamicPaths(node).filter((item) => item.property === 'disabled')
  if (!paths.length || !paths.every((item) => item.path === binding.loadingPath)) return
  return {
    nodeId: node.id,
    level: 'error',
    message: `请求按钮在未加载时被禁用，禁用条件只引用自己的加载状态 ${binding.loadingPath}，用户无法发起请求。请在加载时禁用、空闲时允许点击。`,
  }
}

/** Keep some values intact while removing other fields, without inventing numeric zeros. */
export function partialResponse(value: JsonValue, depth = 0): JsonValue {
  if (depth > 10 || value === null || typeof value !== 'object') return null
  if (Array.isArray(value)) return value.slice(0, 2).map((item) => partialResponse(item, depth + 1))
  return Object.fromEntries(
    Object.entries(value).map(([key, item], index) => [
      key,
      item && typeof item === 'object' ? partialResponse(item, depth + 1) : index % 2 ? null : item,
    ]),
  )
}
function references(value: unknown, path: string): boolean {
  if (!value || typeof value !== 'object') return false
  if ('path' in value && value.path === path) return true
  return Object.values(value).some((item) => references(item, path))
}
/** A selection-dependent feedback panel must not open after submitting an empty selection. */
export function checkEmptySelection(
  nodes: Record<string, ComponentNode>,
  before: State,
  after: State,
  trigger: string,
): CheckIssue[] {
  const empty = Object.values(nodes).filter(
    (node) =>
      node.component === 'ChoicePicker' &&
      node.value &&
      typeof node.value === 'object' &&
      'path' in node.value &&
      Array.isArray(readPath(before, node.value.path)) &&
      !(readPath(before, node.value.path) as JsonValue[]).length,
  )
  if (!empty.length) return []
  const depends = (id: string, path: string, visited = new Set<string>()): boolean => {
    if (visited.has(id) || !nodes[id]) return false
    visited.add(id)
    const node = nodes[id]!
    return (
      ['text', 'tone', 'title', 'description', 'value', 'condition'].some((key) =>
        references(node[key as keyof ComponentNode], path),
      ) || childIds(node).some((child) => depends(child, path, visited))
    )
  }
  for (const node of Object.values(nodes)) {
    if (node.component !== 'LingUI.Conditional' || !node.child) continue
    try {
      if (
        !evaluate(node.condition!, before) &&
        evaluate(node.condition!, after) &&
        empty.some((choice) => depends(node.child!, (choice.value as { path: string }).path))
      )
        return [
          {
            nodeId: trigger,
            level: 'error',
            message: '未选择答案时仍可提交并显示答题反馈，请禁用提交或先校验有效选项。',
          },
        ]
    } catch {
      /* The view-state checker supplies calculation errors. */
    }
  }
  return []
}
