import { writePath, type ComponentNode, type JsonValue, type State } from '@lingui/renderer'

export function initializeWorkspaceNode(node: ComponentNode, nodes: ComponentNode[], state: State) {
  function bind(value: JsonValue) {
    node.value = { path: `/fields/${node.id}` }
    writePath(state, node.value.path, value)
  }
  function content(suffix: string, text: string) {
    const id = `${node.id}-${suffix}`
    nodes.push(
      { id, component: 'Column', children: [`${id}-text`] },
      { id: `${id}-text`, component: 'Text', text },
    )
    return id
  }
  switch (node.component) {
    case 'LingUI.TreeView':
      node.label = '作品目录'
      node.treeItems = [
        { id: 'overview', label: '概览' },
        { id: 'guide', label: '创作指南' },
        { id: 'structure', label: '组织内容', parent: 'guide' },
        { id: 'interaction', label: '设计交互', parent: 'guide' },
        { id: 'publish', label: '分享作品' },
      ]
      bind('overview')
      break
    case 'LingUI.Calendar':
      node.label = '安排创作日期'
      node.month = '2026-10'
      bind('2026-10-13')
      break
    case 'LingUI.CardChoice':
    case 'LingUI.CheckboxGroup':
      node.label = node.component === 'LingUI.CardChoice' ? '选择作品形式' : '选择创作内容'
      node.description = '选择后可通过本地状态与其他内容联动。'
      node.options = [
        { label: '知识图解', value: 'diagram', description: '用结构和步骤解释复杂概念。' },
        { label: '互动练习', value: 'practice', description: '让读者通过操作理解内容。' },
        { label: '数据分析', value: 'analysis', description: '用图表表达比较与变化。' },
      ]
      bind(node.component === 'LingUI.CardChoice' ? 'diagram' : ['diagram'])
      break
    case 'LingUI.Drawer':
      node.label = '作品补充说明'
      node.side = 'right'
      node.trigger = `${node.id}-trigger`
      nodes.push(
        {
          id: node.trigger,
          component: 'Button',
          child: `${node.id}-button-text`,
          variant: 'secondary',
          action: {
            functionCall: { call: 'lingui.dispatch', args: { actions: [{ type: 'reset' }] } },
          },
        },
        { id: `${node.id}-button-text`, component: 'Text', text: '查看说明' },
      )
      node.content = content('content', '在侧边查看补充内容，关闭后继续阅读。')
      break
    case 'LingUI.SplitPane':
      node.label = '对照阅读'
      node.children = [
        content('left', '左侧：描述问题与背景。'),
        content('right', '右侧：展示方案与解释。'),
      ]
      bind(50)
      break
    case 'LingUI.ChatMessage':
      node.sender = '创作助手'
      node.text = '先确定作品想表达什么，再选择合适的组件组织内容。'
      node.variant = 'assistant'
      node.metadata = '对话示例'
      break
    case 'LingUI.Kanban':
      node.label = '创作任务'
      node.boards = [
        {
          id: 'todo',
          title: '待开始',
          cards: [
            {
              id: 'outline',
              title: '梳理内容提纲',
              description: '明确主题与阅读顺序。',
              tag: '内容',
            },
            { id: 'examples', title: '准备互动示例', tag: '交互' },
          ],
        },
        {
          id: 'doing',
          title: '进行中',
          cards: [
            {
              id: 'design',
              title: '打磨组件样式',
              description: '检查留白、边框和窄屏布局。',
              tag: '设计',
            },
          ],
        },
        { id: 'done', title: '已完成', cards: [] },
      ]
      bind({})
      break
    case 'LingUI.ScatterChart':
      node.label = '练习时间与掌握程度'
      node.description = '示例数据，仅用于展示两个数值维度。'
      node.xLabel = '练习时间（分钟）'
      node.yLabel = '掌握程度（分）'
      node.points = [
        { label: '记录 A', x: 15, y: 30 },
        { label: '记录 B', x: 30, y: 55 },
        { label: '记录 C', x: 45, y: 48 },
        { label: '记录 D', x: 60, y: 82 },
        { label: '记录 E', x: 75, y: 90 },
      ]
      break
    case 'LingUI.WaterfallChart':
      node.label = '创作时间变化'
      node.description = '示例数据，展示各阶段增减及最终合计。'
      node.unit = '分钟'
      node.data = [
        { label: '内容准备', value: 40 },
        { label: '结构设计', value: 25 },
        { label: '复用模板', value: -20 },
        { label: '交互调试', value: 15 },
      ]
      break
  }
}
