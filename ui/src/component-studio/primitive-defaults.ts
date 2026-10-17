import { writePath, type ComponentNode, type State } from '@lingui/renderer'

export function initializePrimitiveNode(node: ComponentNode, nodes: ComponentNode[], state: State) {
  const reset = {
    functionCall: {
      call: 'lingui.dispatch' as const,
      args: { actions: [{ type: 'reset' as const }] },
    },
  }
  function content(text: string) {
    const id = `${node.id}-content`
    nodes.push(
      { id, component: 'Column', children: [`${id}-text`] },
      { id: `${id}-text`, component: 'Text', text },
    )
    return id
  }
  switch (node.component) {
    case 'LingUI.Box':
      node.children = []
      node.variant = 'outlined'
      node.padding = 'medium'
      node.gap = 'medium'
      node.direction = 'vertical'
      break
    case 'LingUI.Center':
      node.child = content('把内容放在这里，保持居中与合适的阅读宽度。')
      node.maxWidth = 480
      node.minHeight = 120
      break
    case 'LingUI.Spacer':
      node.size = 'medium'
      node.direction = 'vertical'
      break
    case 'LingUI.Separator':
      node.orientation = 'horizontal'
      break
    case 'LingUI.FormGroup': {
      node.label = '字段分组'
      node.description = '把相关字段放在一起。'
      node.child = content('在此内容区自由添加字段、说明或按钮。')
      const field = `${node.id}-field`
      nodes.find((item) => item.id === node.child)!.children!.push(field)
      nodes.push({
        id: field,
        component: 'TextField',
        label: '字段名称',
        value: { path: `/fields/${field}` },
      })
      writePath(state, `/fields/${field}`, '')
      break
    }
    case 'LingUI.ButtonGroup':
      node.label = '相关操作'
      node.direction = 'horizontal'
      node.gap = 'small'
      node.children = ['first', 'second'].map((suffix, index) => {
        const id = `${node.id}-${suffix}`
        nodes.push(
          {
            id,
            component: 'Button',
            variant: index ? 'secondary' : 'primary',
            child: `${id}-text`,
            action: reset,
          },
          { id: `${id}-text`, component: 'Text', text: index ? '次要操作' : '主要操作' },
        )
        return id
      })
      break
    case 'LingUI.IconButton':
      node.label = '重置当前实例'
      node.name = 'arrow'
      node.variant = 'secondary'
      node.action = reset
      break
    case 'LingUI.Popover':
      node.label = '补充内容'
      node.placement = 'bottom'
      node.trigger = `${node.id}-trigger`
      nodes.push(
        { id: node.trigger, component: 'Button', child: `${node.trigger}-text`, action: reset },
        { id: `${node.trigger}-text`, component: 'Text', text: '打开浮层' },
      )
      node.content = content('这里可以组合说明、输入框或相关操作。点击外部或按 Esc 收起。')
      break
    case 'LingUI.InlineCode':
      node.text = 'component.value'
      break
    case 'LingUI.Highlight':
      node.text = '值得关注的内容'
      node.tone = 'accent'
      break
  }
}
