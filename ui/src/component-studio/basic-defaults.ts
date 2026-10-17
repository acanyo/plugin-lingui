import { writePath, type ComponentNode, type State } from '@lingui/renderer'

/** Defaults for the Basic Catalog kinds; children remain editable in the structure tree. */
export function initializeBasicNode(node: ComponentNode, nodes: ComponentNode[], state: State) {
  const field = `/fields/${node.id}`
  if (['Image', 'Video', 'AudioPlayer'].includes(node.component)) {
    node.url = ''
    node.description =
      node.component === 'Image' ? '图片说明' : node.component === 'Video' ? '视频说明' : '音频说明'
    if (node.component === 'Image') {
      node.fit = 'cover'
      node.variant = 'mediumFeature'
    }
  }
  if (node.component === 'List') {
    node.children = []
    node.direction = 'vertical'
  }
  if (node.component === 'Tabs') {
    const child = `${node.id}-content`
    node.value = { path: field }
    node.tabs = [{ title: '标签一', child }]
    nodes.push({ id: child, component: 'Column', children: [] })
    writePath(state, field, 0)
  }
  if (node.component === 'Modal') {
    node.label = '详细内容'
    node.trigger = `${node.id}-trigger`
    node.content = `${node.id}-content`
    nodes.push(
      {
        id: node.trigger,
        component: 'Button',
        child: `${node.id}-text`,
        action: {
          functionCall: { call: 'lingui.dispatch', args: { actions: [{ type: 'reset' }] } },
        },
      },
      { id: `${node.id}-text`, component: 'Text', text: '查看详情' },
      { id: node.content, component: 'Column', children: [`${node.id}-body`] },
      { id: `${node.id}-body`, component: 'Text', text: '在这里填写详细说明。' },
    )
  }
  if (node.component === 'DateTimeInput') {
    node.label = '选择日期'
    node.value = { path: field }
    node.enableDate = true
    node.enableTime = false
    writePath(state, field, '')
  }
}
