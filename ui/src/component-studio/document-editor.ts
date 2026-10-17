import {
  serializeSource,
  childIds,
  resolveDocument,
  validateDocument,
  validateInstance,
  writePath,
  type ComponentInstance,
  type ComponentName,
  type ComponentNode,
  type Dynamic,
  type LinguiDocument,
  type State,
} from '@lingui/renderer'
import { initializeInteractionNode } from './interaction-defaults'
import { initializeBasicNode } from './basic-defaults'
import { initializeExtendedNode } from './extended-defaults'
import { initializeAdvancedNode } from './advanced-defaults'
import { initializeProductivityNode } from './productivity-defaults'
import { initializeWorkspaceNode } from './workspace-defaults'
import { initializePrimitiveNode } from './primitive-defaults'
export function createBlankDocument(): LinguiDocument {
  return { schemaVersion: 'lingui.document/2', title: '我的新组件', parameters: [],
    source: serializeSource([{ id: 'root', component: 'Column', children: [] }]), state: {} }
}
/** Structural edits preserve article parameters; explicit default edits update the matching value. */
export function updateInstanceDocument(
  instance: ComponentInstance,
  document: LinguiDocument,
): ComponentInstance {
  const safe = validateDocument(document)
  const previous = new Map(
    instance.document.parameters.map((parameter) => [parameter.key, parameter]),
  )
  const parameters = Object.fromEntries(
    safe.parameters.map((parameter) => {
      const old = previous.get(parameter.key)
      const value =
        old?.type === parameter.type && old.default === parameter.default
          ? (instance.parameters[parameter.key] ?? parameter.default)
          : parameter.default
      return [parameter.key, value]
    }),
  )
  return validateInstance({ ...instance, document: safe, parameters })
}
export function replaceSurface(
  document: LinguiDocument,
  nodes: ComponentNode[],
  state: State,
): LinguiDocument {
  return { ...document, source: serializeSource(nodes), state }
}

export function updateNode(document: LinguiDocument, node: ComponentNode): LinguiDocument {
  const surface = resolveDocument(document)
  return replaceSurface(
    document,
    Object.values(surface.nodes).map((item) => (item.id === node.id ? node : item)),
    surface.state,
  )
}
export function updateText(
  document: LinguiDocument,
  id: string,
  property: 'text' | 'title' | 'description' | 'label' | 'url',
  value: string,
): LinguiDocument {
  const surface = resolveDocument(document),
    node = surface.nodes[id]!
  const field = node[property] as Dynamic | undefined
  if (field && typeof field === 'object' && 'path' in field) {
    writePath(surface.state, field.path, value)
    return replaceSurface(
      {
        ...document,
        parameters: document.parameters.map((parameter) =>
          parameter.path === field.path ? { ...parameter, default: value } : parameter,
        ),
      },
      Object.values(surface.nodes),
      surface.state,
    )
  }
  return updateNode(document, { ...node, [property]: value })
}
export function removeNode(document: LinguiDocument, id: string): LinguiDocument {
  if (id === 'root') throw new Error('根节点不能删除')
  const surface = resolveDocument(document)
  for (const node of Object.values(surface.nodes)) {
    if (node.component === 'LingUI.SplitPane' && node.children?.includes(id))
      throw new Error('分栏必须保留两个内容区域，请删除整个分栏')
    if (node.trigger === id || node.content === id)
      throw new Error('请删除整个弹窗，或先修改弹窗的触发器与内容引用')
    if (node.child === id) throw new Error('此节点是容器的唯一内容，请先把容器改为布局或删除容器')
    if (node.tabs?.some((tab) => tab.child === id)) throw new Error('请通过标签页属性移除对应页')
    if (node.sections?.some((section) => section.child === id))
      throw new Error('请通过手风琴属性移除对应分组')
    if (
      node.component === 'LingUI.Carousel' &&
      node.children?.includes(id) &&
      node.children.length <= 1
    )
      throw new Error('轮播至少保留一页，请删除整个轮播')
    const contained = node.children?.includes(id)
    if (node.children) node.children = node.children.filter((child) => child !== id)
    if (
      contained &&
      node.component === 'LingUI.Carousel' &&
      node.value &&
      typeof node.value === 'object' &&
      'path' in node.value
    )
      writePath(surface.state, node.value.path, 0)
  }
  const reachable = new Set<string>()
  const visit = (nodeId: string) => {
    if (reachable.has(nodeId)) return
    reachable.add(nodeId)
    childIds(surface.nodes[nodeId]!).forEach(visit)
  }
  visit('root')
  return replaceSurface(
    document,
    Object.values(surface.nodes).filter((node) => reachable.has(node.id)),
    surface.state,
  )
}
export function addNode(
  document: LinguiDocument,
  parentId: string,
  type: ComponentName,
): { document: LinguiDocument; id: string } {
  const surface = resolveDocument(document),
    parent = surface.nodes[parentId]!
  if (
    ![
      'Column',
      'Row',
      'List',
      'LingUI.Section',
      'LingUI.Grid',
      'LingUI.Toolbar',
      'LingUI.Box',
      'LingUI.ButtonGroup',
      'LingUI.Carousel',
      'LingUI.Diagram',
      'LingUI.DiagramNode',
      'LingUI.Timeline',
      'LingUI.Steps',
    ].includes(parent.component)
  )
    throw new Error('请先选择布局、图表、时间线或步骤容器，再添加节点')
  if (parent.component === 'LingUI.Diagram' && type !== 'LingUI.DiagramNode')
    throw new Error('架构图内请添加架构节点')
  if (parent.component === 'LingUI.Timeline' && type !== 'LingUI.TimelineItem')
    throw new Error('时间线内请添加时间节点')
  if (parent.component === 'LingUI.Carousel' && (parent.children?.length ?? 0) >= 12)
    throw new Error('轮播最多包含 12 页')
  const id = `node-${crypto.randomUUID().slice(0, 8)}`
  const node: ComponentNode = { id, component: type }
  const nodes: ComponentNode[] = [node]
  const contentId = `${id}-content`
  const field = `/fields/${id}`
  initializeBasicNode(node, nodes, surface.state)
  initializeExtendedNode(node, nodes, surface.state)
  initializeAdvancedNode(node, nodes, surface.state)
  initializeProductivityNode(node, nodes, surface.state)
  initializeWorkspaceNode(node, nodes, surface.state)
  initializePrimitiveNode(node, nodes, surface.state)
  initializeInteractionNode(node, surface.state)
  switch (type) {
    case 'LingUI.Section':
      node.title = '新的章节'
      node.description = '用一句话介绍这一部分'
      node.children = []
      break
    case 'LingUI.Grid':
      node.children = []
      node.maxColumns = 2
      break
    case 'LingUI.CodeBlock':
      node.code = '// 在这里填写代码'
      node.language = 'text'
      break
    case 'LingUI.KeyValue':
      node.entries = [{ label: '名称', value: '内容' }]
      break
    case 'LingUI.BarChart':
      node.label = '数据对比'
      node.description = '示例数据，请替换为真实数据'
      node.data = [
        { label: '方案一', value: 80 },
        { label: '方案二', value: 60 },
      ]
      break
    case 'Column':
    case 'Row':
    case 'LingUI.Diagram':
    case 'LingUI.Timeline':
    case 'LingUI.Steps':
      node.children = []
      break
    case 'Text':
    case 'LingUI.Badge':
    case 'LingUI.Quote':
      node.text = '输入你的内容'
      break
    case 'LingUI.Metric':
      node.label = '指标名称'
      node.value = '128'
      node.description = '指标说明'
      break
    case 'LingUI.Table':
      node.label = '方案对比'
      node.columns = ['对比项', '方案一', '方案二']
      node.rows = [{ label: '适用场景', cells: ['个人使用', '团队协作'] }]
      break
    case 'Icon':
      node.name = 'info'
      break
    case 'Card':
    case 'LingUI.Callout':
    case 'LingUI.Collapse':
    case 'LingUI.Conditional':
    case 'Button':
      node.child = contentId
      nodes.push({
        id: contentId,
        component: type === 'Button' ? 'Text' : 'Column',
        ...(type === 'Button' ? { text: '按钮' } : { children: [] }),
      })
      break
    case 'LingUI.DiagramNode':
      node.title = '新节点'
      node.description = '节点说明'
      node.children = []
      break
    case 'LingUI.TimelineItem':
      node.title = '新阶段'
      node.description = '描述这个阶段'
      break
  }
  if (type === 'LingUI.Collapse') {
    node.title = '展开说明'
    node.expanded = { path: field }
    writePath(surface.state, field, false)
  }
  if (type === 'LingUI.Conditional') node.condition = true
  if (type === 'Button')
    node.action = {
      functionCall: { call: 'lingui.dispatch', args: { actions: [{ type: 'reset' }] } },
    }
  if (
    [
      'TextField',
      'LingUI.NumberInput',
      'Slider',
      'CheckBox',
      'ChoicePicker',
      'LingUI.Progress',
      'LingUI.Steps',
    ].includes(type)
  ) {
    node.label = '新字段'
    node.value = { path: field }
    writePath(
      surface.state,
      field,
      type === 'TextField' ? '' : type === 'CheckBox' ? false : type === 'ChoicePicker' ? [] : 0,
    )
  }
  if (type === 'LingUI.Steps') delete node.label
  if (type === 'Slider') {
    node.min = 0
    node.max = 100
    node.step = 1
  }
  if (type === 'ChoicePicker')
    node.options = [
      { label: '选项一', value: 'one' },
      { label: '选项二', value: 'two' },
    ]
  if (type === 'LingUI.Tabs') {
    node.value = { path: field }
    node.tabs = [{ title: '标签一', child: contentId }]
    nodes.push({ id: contentId, component: 'Column', children: [] })
    writePath(surface.state, field, 0)
  }
  parent.children = [...(parent.children ?? []), id]
  return {
    id,
    document: replaceSurface(document, [...Object.values(surface.nodes), ...nodes], surface.state),
  }
}
export function moveNode(document: LinguiDocument, id: string, direction: number): LinguiDocument {
  const surface = resolveDocument(document)
  const parent = Object.values(surface.nodes).find((node) => node.children?.includes(id))
  if (!parent?.children) return document
  const from = parent.children.indexOf(id),
    to = from + direction
  if (to < 0 || to >= parent.children.length) return document
  ;[parent.children[from], parent.children[to]] = [parent.children[to]!, parent.children[from]!]
  return replaceSurface(document, Object.values(surface.nodes), surface.state)
}
