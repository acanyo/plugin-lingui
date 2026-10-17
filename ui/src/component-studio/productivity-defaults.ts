import { writePath, type ComponentNode, type State, type JsonValue } from '@lingui/renderer'
/** Defaults belong to the unsaved document. They never seed the project list. */
export function initializeProductivityNode(
  node: ComponentNode,
  nodes: ComponentNode[],
  state: State,
) {
  const bind = (value: JsonValue) => {
    node.value = { path: `/fields/${node.id}` }
    writePath(state, `/fields/${node.id}`, value)
  }
  const content = (suffix: string, text: string) => {
    const child = `${node.id}-${suffix}`
    nodes.push(
      { id: child, component: 'Column', children: [`${child}-text`] },
      { id: `${child}-text`, component: 'Text', text },
    )
    return child
  }
  switch (node.component) {
    case 'LingUI.RangeSlider':
      node.label = '选择预算区间'
      node.min = 0
      node.max = 1000
      node.step = 10
      node.unit = '元'
      bind({ start: 200, end: 700 })
      break
    case 'LingUI.DateRange':
      node.label = '选择计划日期'
      bind({ start: '', end: '' })
      break
    case 'LingUI.NumberStepper':
      node.label = '参与人数'
      node.min = 1
      node.max = 20
      node.step = 1
      node.unit = '人'
      bind(3)
      break
    case 'LingUI.PasswordInput':
      node.label = '演示口令'
      node.placeholder = '输入演示内容'
      node.maxLength = 120
      bind('')
      break
    case 'LingUI.Combobox':
      node.label = '选择创作主题'
      node.placeholder = '搜索并选择主题'
      node.options = [
        { label: '界面设计', value: 'design' },
        { label: '交互体验', value: 'interaction' },
        { label: '数据图解', value: 'data' },
        { label: '开发工具', value: 'tools' },
      ]
      bind('design')
      break
    case 'LingUI.Transfer':
      node.label = '组织作品内容'
      node.sourceLabel = '可添加'
      node.targetLabel = '已添加'
      node.options = [
        { label: '内容章节', value: 'section' },
        { label: '互动表单', value: 'form' },
        { label: '架构图解', value: 'diagram' },
        { label: '趋势分析', value: 'chart' },
      ]
      bind(['section'])
      break
    case 'LingUI.ToggleButton':
      node.label = '收藏此灵感'
      node.description = '点击切换选中状态'
      bind(false)
      break
    case 'LingUI.Carousel':
      node.label = '创作步骤'
      node.children = [
        content('slide-1', '从一个清楚的需求开始。'),
        content('slide-2', '通过对话与手动编辑打磨细节。'),
        content('slide-3', '试用交互，准备好后分享作品。'),
      ]
      bind(0)
      break
    case 'LingUI.ScrollArea':
      node.label = '阅读说明'
      node.maxHeight = 160
      node.child = content('content', '这里是可滚动的内容区域。')
      for (let i = 0; i < 5; i++) {
        const id = `${node.id}-paragraph-${i}`
        nodes.find((item) => item.id === node.child)!.children!.push(id)
        nodes.push({
          id,
          component: 'Text',
          text: [
            '从需求开始，先确定作品想表达什么。',
            '选择合适的组件，把内容组织成清楚的结构。',
            '输入控件和展示内容可以通过本地状态联动。',
            '在预览中试用，检查文字、尺寸与交互。',
            '调整完成后保存作品，再选择分享方式。',
          ][i],
        })
      }
      break
    case 'LingUI.AspectRatio':
      node.ratio = 'wide'
      node.child = content('content', '按比例展示内容，窄屏时自动适应宽度。')
      break
    case 'LingUI.KeyboardShortcut':
      node.label = '保存作品'
      node.keys = ['⌘', 'S']
      break
    case 'LingUI.FileCard':
      node.label = '作品使用指南'
      node.description = '补充说明与参考资料'
      node.metadata = '文档 · 自定义链接'
      node.url = ''
      node.newWindow = true
      break
    case 'LingUI.AvatarGroup':
      node.label = '参与创作'
      node.members = ['小林', '阿禾', '周舟', '南山', '清川', '晓雨'].map((label) => ({ label }))
      node.maxVisible = 4
      break
    case 'LingUI.ProgressRing':
      node.label = '准备进度'
      node.description = '示例数值，可连接作品参数'
      node.max = 100
      bind(72)
      break
    case 'LingUI.Sparkline':
      node.label = '最近练习记录'
      node.description = '示例数据，请替换为真实记录'
      node.unit = '次'
      node.data = [2, 4, 3, 6, 5, 8, 7].map((value, i) => ({ label: `第 ${i + 1} 天`, value }))
      break
    case 'LingUI.FunnelChart':
      node.label = '创作完成流程'
      node.description = '示例数据，请替换为真实数据'
      node.unit = '人'
      node.data = [
        { label: '开始创作', value: 1000 },
        { label: '完成内容', value: 680 },
        { label: '试用调整', value: 420 },
        { label: '分享作品', value: 260 },
      ]
      break
  }
}
