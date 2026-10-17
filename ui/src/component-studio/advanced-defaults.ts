import { writePath, type ComponentNode, type State } from '@lingui/renderer'

/** New controls start with local values; gallery previews never create projects. */
export function initializeAdvancedNode(node: ComponentNode, nodes: ComponentNode[], state: State) {
  const field = `/fields/${node.id}`
  const bind = (value: string | number | boolean | string[]) => {
    node.value = { path: field }
    writePath(state, field, value)
  }
  switch (node.component) {
    case 'LingUI.SearchInput':
      node.label = '搜索作品'
      node.placeholder = '输入关键词'
      node.maxLength = 120
      node.disabled = false
      bind('')
      break
    case 'LingUI.ColorPicker':
      node.label = '选择强调色'
      node.disabled = false
      bind('#2563eb')
      break
    case 'LingUI.MultiSelect':
      node.label = '关注的主题'
      node.placeholder = '选择一个或多个主题'
      node.maxSelected = 3
      node.disabled = false
      node.options = [
        { label: '界面设计', value: 'design' },
        { label: '交互体验', value: 'interaction' },
        { label: '数据展示', value: 'data' },
        { label: '开发工具', value: 'tools' },
      ]
      bind(['design'])
      break
    case 'LingUI.TagInput':
      node.label = '作品标签'
      node.placeholder = '输入标签后按回车'
      node.maxTags = 8
      node.disabled = false
      bind(['灵感', '设计'])
      break
    case 'LingUI.Pagination':
      node.label = '作品分页'
      node.totalPages = 12
      node.disabled = false
      bind(1)
      break
    case 'LingUI.Alert':
      node.title = '这是可关闭的信息提示'
      node.description = '点击右侧关闭按钮，重置预览后恢复显示。'
      node.tone = 'info'
      node.dismissible = true
      bind(true)
      break
    case 'LingUI.Status':
      node.text = '运行正常'
      node.tone = 'success'
      break
    case 'LingUI.Tooltip':
      node.label = '什么是实时预览？'
      node.text = '修改内容后，在预览中立即试用。读者的操作只影响当前实例。'
      break
    case 'LingUI.Accordion': {
      node.label = '常见问题'
      node.allowMultiple = false
      node.sections = ['如何开始创作？', '可以手动调整吗？', '如何分享作品？'].map(
        (title, index) => {
          const child = `${node.id}-section-${index + 1}`,
            text = `${child}-text`
          nodes.push(
            { id: child, component: 'Column', children: [text] },
            {
              id: text,
              component: 'Text',
              text: [
                '从一句具体的需求开始，逐步补充内容和交互。',
                '在手动编辑中调整结构、文字和组件属性。',
                '准备好后保存作品，再选择发布到市场。',
              ][index],
            },
          )
          return { title, child }
        },
      )
      bind([node.sections[0]!.child])
      break
    }
    case 'LingUI.LabeledDivider':
      node.text = '继续探索'
      break
    case 'LingUI.Toolbar': {
      node.label = '作品操作'
      node.children = [`${node.id}-button`, `${node.id}-status`]
      nodes.push(
        {
          id: node.children[0]!,
          component: 'Button',
          child: `${node.id}-text`,
          variant: 'secondary',
          action: {
            functionCall: { call: 'lingui.dispatch', args: { actions: [{ type: 'reset' }] } },
          },
        },
        { id: `${node.id}-text`, component: 'Text', text: '重置交互' },
        {
          id: node.children[1]!,
          component: 'LingUI.Status',
          text: '可以继续试用',
          tone: 'success',
        },
      )
      break
    }
    case 'LingUI.Gauge':
      node.label = '学习进度'
      node.description = '示例数据，请替换为真实数据'
      node.min = 0
      node.max = 100
      node.unit = '%'
      bind(72)
      break
    case 'LingUI.RadarChart':
      node.label = '方案维度对比'
      node.description = '示例评分，不代表真实评价'
      node.max = 100
      node.data = [
        { label: '易用性', value: 85 },
        { label: '可读性', value: 92 },
        { label: '响应速度', value: 78 },
        { label: '灵活程度', value: 88 },
        { label: '完整程度', value: 70 },
      ]
      break
    case 'LingUI.Heatmap':
      node.label = '每周练习分布'
      node.description = '示例数据，请替换为真实记录'
      node.unit = '次'
      node.columns = ['周一', '周二', '周三', '周四', '周五']
      node.matrix = [
        { label: '界面', cells: [2, 4, 1, 5, 3] },
        { label: '交互', cells: [1, 3, 4, 2, 6] },
        { label: '图解', cells: [0, 2, 3, 4, 2] },
      ]
      break
  }
}
