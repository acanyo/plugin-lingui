import type { ComponentNode } from './types'

const unsafe = new Set(['__proto__', 'constructor', 'prototype'])
export function validateWorkspaceNode(node: ComponentNode) {
  if (node.component === 'LingUI.Calendar' && node.month?.startsWith('0000'))
    throw new Error(`节点 ${node.id} 的日历年份无效`)
  if (node.component === 'LingUI.SplitPane' && node.children?.[0] === node.children?.[1])
    throw new Error(`节点 ${node.id} 的分栏内容不能重复`)
  if (node.treeItems) {
    const items = new Map(node.treeItems.map((item) => [item.id, item]))
    if (items.size !== node.treeItems.length) throw new Error('树节点标识不能重复')
    for (const item of node.treeItems) {
      const visited = new Set<string>()
      let current: typeof item | undefined = item
      while (current) {
        if (unsafe.has(current.id) || visited.has(current.id))
          throw new Error('树节点标识无效或存在循环')
        visited.add(current.id)
        if (visited.size > 8) throw new Error('树导航最多支持 8 层')
        if (current.parent && !items.has(current.parent)) throw new Error('树节点的父级不存在')
        current = current.parent ? items.get(current.parent) : undefined
      }
    }
  }
  if (node.boards) {
    const ids = new Set<string>()
    for (const item of [...node.boards, ...node.boards.flatMap((board) => board.cards)]) {
      if (unsafe.has(item.id) || ids.has(item.id)) throw new Error('看板与任务标识必须安全且唯一')
      ids.add(item.id)
    }
    if (node.boards.reduce((count, board) => count + board.cards.length, 0) > 24)
      throw new Error('看板最多支持 24 个任务')
  }
}
