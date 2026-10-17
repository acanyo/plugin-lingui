import {
  createInstance,
  resolveDocument,
  writePath,
  type ComponentName,
  type LinguiDocument,
} from '@lingui/renderer'
import { addNode, createBlankDocument, replaceSurface, updateNode } from './document-editor'
import { addTab } from './tabs-editor'
import { nodeLabels } from './catalog-labels'

function addText(document: LinguiDocument, parent: string, text: string) {
  const added = addNode(document, parent, 'Text')
  return updateNode(added.document, { id: added.id, component: 'Text', text })
}

/** Uses the same trusted node defaults as manual editing, without creating a saved project. */
export function createCatalogPreview(component: ComponentName) {
  let document = createBlankDocument()
  let parent = 'root'
  const container =
    component === 'LingUI.DiagramNode'
      ? 'LingUI.Diagram'
      : component === 'LingUI.TimelineItem'
        ? 'LingUI.Timeline'
        : undefined
  if (container) {
    const added = addNode(document, parent, container)
    document = added.document
    parent = added.id
  }
  const added = addNode(document, parent, component)
  document = added.document
  const node = resolveDocument(document).nodes[added.id]!
  if (
    [
      'Column',
      'Row',
      'List',
      'LingUI.Section',
      'LingUI.Grid',
      'LingUI.Steps',
      'LingUI.Box',
    ].includes(component)
  ) {
    document = addText(document, node.id, '第一部分内容')
    document = addText(document, node.id, '第二部分内容')
  }
  if (['Card', 'LingUI.Callout', 'LingUI.Collapse', 'LingUI.Conditional'].includes(component)) {
    document = addText(document, node.child!, '把相关的内容放在一起，让信息更容易理解。')
  }
  if (component === 'Tabs' || component === 'LingUI.Tabs') {
    document = addTab(document, node.id)
    const tabs = resolveDocument(document).nodes[node.id]!.tabs!
    document = addText(document, tabs[0]!.child, '这里是第一组内容。点击另一个标签，切换阅读。')
    document = addText(document, tabs[1]!.child, '这里是第二组内容，每个标签都有独立的内容区域。')
  }
  if (component === 'LingUI.Diagram' || component === 'LingUI.Timeline') {
    const kind = component === 'LingUI.Diagram' ? 'LingUI.DiagramNode' : 'LingUI.TimelineItem'
    for (const title of ['理解问题', '完成实践']) {
      const child = addNode(document, node.id, kind)
      document = updateNode(child.document, {
        ...resolveDocument(child.document).nodes[child.id]!,
        title,
        description: '用一个清楚的阶段说明过程。',
      })
    }
  }
  if (component === 'LingUI.Progress' || component === 'Slider') {
    const surface = resolveDocument(document)
    writePath(surface.state, `/fields/${node.id}`, 60)
    document = replaceSurface(document, Object.values(surface.nodes), surface.state)
  }
  if (component === 'LingUI.Spacer' || component === 'LingUI.Separator') {
    document = addText(document, 'root', '上方内容')
    const surface = resolveDocument(document)
    const root = surface.nodes.root!
    root.children = [root.children!.at(-1)!, node.id]
    document = replaceSurface(document, Object.values(surface.nodes), surface.state)
    document = addText(document, 'root', '下方内容')
  }
  if (component === 'LingUI.FileCard')
    document = updateNode(document, { ...node, url: '#lingui-guide', newWindow: false })
  if (component === 'LingUI.Link')
    document = updateNode(document, {
      ...node,
      text: '探索更多创作灵感',
      url: '#lingui-preview',
      newWindow: false,
    })
  if (component === 'LingUI.Breadcrumbs')
    document = updateNode(document, {
      ...node,
      items: [
        { label: '工作空间', url: '#workspace' },
        { label: '作品', url: '#works' },
        { label: '当前作品' },
      ],
    })
  return createInstance({ ...document, title: nodeLabels[component] })
}
