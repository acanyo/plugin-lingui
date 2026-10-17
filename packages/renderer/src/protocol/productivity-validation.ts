import { dateInputValue } from './date-time'
import { safeLinkUrl } from './link-url'
import { safeMediaUrl } from './media-url'
import type { ComponentNode } from './types'

export function validateProductivityNode(node: ComponentNode) {
  if (node.component === 'LingUI.RangeSlider' && Number(node.min) >= Number(node.max))
    throw new Error(`节点 ${node.id} 的范围上限必须大于下限`)
  if (node.component === 'LingUI.DateRange') {
    for (const bound of [node.min, node.max])
      if (bound !== undefined && !dateInputValue(bound, true, false))
        throw new Error(`节点 ${node.id} 的日期范围无效`)
    if (node.min !== undefined && node.max !== undefined && node.min > node.max)
      throw new Error(`节点 ${node.id} 的日期范围无效`)
  }
  if (node.component === 'LingUI.Carousel' && new Set(node.children).size !== node.children?.length)
    throw new Error(`节点 ${node.id} 的轮播内容不能重复`)
  if (
    node.component === 'LingUI.FileCard' &&
    typeof node.url === 'string' &&
    node.url &&
    !safeLinkUrl(node.url)
  )
    throw new Error(`节点 ${node.id} 的文件链接无效`)
  if (node.members?.some((member) => member.url && !safeMediaUrl(member.url)))
    throw new Error(`节点 ${node.id} 的成员头像地址无效`)
  if (
    node.component === 'LingUI.FunnelChart' &&
    node.data?.some((item, index, data) => index > 0 && item.value > data[index - 1]!.value)
  )
    throw new Error(`节点 ${node.id} 的漏斗数值必须按阶段非递增排列`)
}
