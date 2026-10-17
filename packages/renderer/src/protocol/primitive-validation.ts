import type { ComponentNode } from './types'

export function validatePrimitiveNode(node: ComponentNode, nodes: Record<string, ComponentNode>) {
  if (node.component === 'LingUI.Popover') {
    if (node.trigger === node.content) throw new Error('浮层的触发器和内容不能相同')
    const trigger = nodes[node.trigger!]
    if (!trigger || !['Button', 'LingUI.IconButton'].includes(trigger.component))
      throw new Error('浮层触发器需要使用按钮或图标按钮')
  }
}
