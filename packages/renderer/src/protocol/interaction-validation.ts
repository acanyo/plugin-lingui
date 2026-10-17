import type { Action, ComponentNode } from './types'
import { segments } from '../interaction-runtime/pointer'

export function validateLocalAction(action: Action | undefined, id: string) {
  for (const item of action?.functionCall.args.actions ?? []) {
    if (item.type !== 'reset') {
      if (!item.path || !segments(item.path).length)
        throw new Error(`节点 ${id} 的动作缺少有效状态路径`)
    }
    if (['setState', 'selectOption'].includes(item.type) && item.value === undefined)
      throw new Error(`节点 ${id} 的动作缺少值`)
  }
}
export function validateInteractionNode(node: ComponentNode) {
  validateLocalAction(node.action, node.id)
  if (node.menuItems) {
    if (new Set(node.menuItems.map((item) => item.id)).size !== node.menuItems.length)
      throw new Error(`节点 ${node.id} 的菜单标识不能重复`)
    for (const item of node.menuItems) if (item.action) validateLocalAction(item.action, node.id)
  }
  if (node.fields) {
    if (
      node.fields.some((field) => ['__proto__', 'prototype', 'constructor'].includes(field.key)) ||
      new Set(node.fields.map((field) => field.key)).size !== node.fields.length
    )
      throw new Error(`节点 ${node.id} 的字段标识必须安全且唯一`)
    if ((node.minRows ?? 0) > (node.maxRows ?? 10))
      throw new Error(`节点 ${node.id} 的行数范围无效`)
  }
}
