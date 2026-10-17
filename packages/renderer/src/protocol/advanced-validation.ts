import type { ComponentNode } from './types'

/** Cross-field invariants that cannot be expressed by individual property bounds. */
export function validateAdvancedNode(node: ComponentNode) {
  if (node.component === 'LingUI.Gauge' && Number(node.min) >= Number(node.max))
    throw new Error(`节点 ${node.id} 的仪表盘最大值必须大于最小值`)
  if (
    node.component === 'LingUI.RadarChart' &&
    node.data?.some((item) => item.value > Number(node.max))
  )
    throw new Error(`节点 ${node.id} 的雷达数值不能超过刻度上限`)
  if (
    node.component === 'LingUI.Heatmap' &&
    node.matrix?.some((row) => row.cells.length !== node.columns?.length)
  )
    throw new Error(`节点 ${node.id} 的热力表列数不一致`)
  if (
    node.sections &&
    new Set(node.sections.map((section) => section.child)).size !== node.sections.length
  )
    throw new Error(`节点 ${node.id} 的手风琴内容引用不能重复`)
}
