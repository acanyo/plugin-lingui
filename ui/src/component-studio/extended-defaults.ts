import { writePath, type ComponentNode, type State } from '@lingui/renderer'

/** Extension defaults are independent of saved projects and never seed the database. */
export function initializeExtendedNode(node: ComponentNode, nodes: ComponentNode[], state: State) {
  const field = `/fields/${node.id}`
  if (
    ['LingUI.Switch', 'LingUI.Select', 'LingUI.SegmentedControl', 'LingUI.Rating'].includes(
      node.component,
    )
  ) {
    node.value = { path: field }
    node.disabled = false
  }
  switch (node.component) {
    case 'LingUI.Switch':
      node.label = '接收更新提醒'
      node.description = '随时调整你的偏好'
      writePath(state, field, true)
      break
    case 'LingUI.Select':
    case 'LingUI.SegmentedControl':
      node.label = node.component === 'LingUI.Select' ? '选择分类' : '查看范围'
      node.options = [
        { label: '全部', value: 'all' },
        { label: '进行中', value: 'active' },
        { label: '已完成', value: 'done' },
      ]
      if (node.component === 'LingUI.Select') node.placeholder = '请选择分类'
      writePath(state, field, 'all')
      break
    case 'LingUI.Rating':
      node.label = '这次体验怎么样？'
      node.max = 5
      node.readOnly = false
      writePath(state, field, 4)
      break
    case 'LingUI.Avatar':
      node.label = '创作者'
      node.description = '记录灵感，分享作品'
      node.url = ''
      node.size = 'medium'
      break
    case 'LingUI.Link':
      node.text = '了解更多'
      node.url = ''
      node.newWindow = true
      break
    case 'LingUI.Breadcrumbs':
      node.label = '当前位置'
      node.items = [{ label: '工作空间' }, { label: '作品' }, { label: '当前作品' }]
      break
    case 'LingUI.EmptyState':
      node.title = '还没有内容'
      node.description = '从一个想法开始，创建你的第一份作品。'
      node.name = 'layers'
      node.child = `${node.id}-content`
      nodes.push({ id: node.child, component: 'Column', children: [] })
      break
    case 'LingUI.Skeleton':
      node.label = '正在准备内容'
      node.variant = 'avatar'
      node.lines = 3
      break
    case 'LingUI.Spinner':
      node.label = '正在加载，请稍候'
      node.size = 'medium'
      break
    case 'LingUI.LineChart':
    case 'LingUI.DonutChart':
      node.label = node.component === 'LingUI.LineChart' ? '每周创作趋势' : '作品类型分布'
      node.description = '示例数据，请替换为真实数据'
      node.unit = '件'
      node.data =
        node.component === 'LingUI.LineChart'
          ? [
              { label: '周一', value: 12 },
              { label: '周二', value: 18 },
              { label: '周三', value: 14 },
              { label: '周四', value: 28 },
              { label: '周五', value: 24 },
            ]
          : [
              { label: '交互组件', value: 48 },
              { label: '数据图解', value: 32 },
              { label: '内容展示', value: 20 },
            ]
      break
  }
}
