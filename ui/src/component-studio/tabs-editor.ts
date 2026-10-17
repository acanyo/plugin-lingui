import { childIds, resolveDocument, writePath, type LinguiDocument } from '@lingui/renderer'
import { replaceSurface } from './document-editor'

export function addTab(document: LinguiDocument, id: string): LinguiDocument {
  const surface = resolveDocument(document),
    node = surface.nodes[id]!
  if (!node.tabs || node.tabs.length >= 20) throw new Error('最多允许 20 个标签页')
  const child = `tab-${crypto.randomUUID().slice(0, 8)}`
  node.tabs.push({ title: `标签 ${node.tabs.length + 1}`, child })
  surface.nodes[child] = { id: child, component: 'Column', children: [] }
  return replaceSurface(document, Object.values(surface.nodes), surface.state)
}
export function renameTab(
  document: LinguiDocument,
  id: string,
  index: number,
  title: string,
): LinguiDocument {
  const surface = resolveDocument(document),
    tab = surface.nodes[id]!.tabs![index]!
  if (typeof tab.title === 'object' && 'path' in tab.title)
    writePath(surface.state, tab.title.path, title)
  else tab.title = title
  const titlePath =
    typeof tab.title === 'object' && 'path' in tab.title ? tab.title.path : undefined
  const parameters = titlePath
    ? document.parameters.map((parameter) =>
        parameter.path === titlePath ? { ...parameter, default: title } : parameter,
      )
    : document.parameters
  return replaceSurface({ ...document, parameters }, Object.values(surface.nodes), surface.state)
}
export function removeTab(document: LinguiDocument, id: string, index: number): LinguiDocument {
  const surface = resolveDocument(document),
    node = surface.nodes[id]!
  if (!node.tabs || node.tabs.length <= 1) throw new Error('至少保留一个标签页')
  node.tabs.splice(index, 1)
  if (node.value && typeof node.value === 'object' && 'path' in node.value)
    writePath(surface.state, node.value.path, 0)
  const reachable = new Set<string>()
  function visit(child: string) {
    if (reachable.has(child)) return
    reachable.add(child)
    childIds(surface.nodes[child]!).forEach(visit)
  }
  visit('root')
  return replaceSurface(
    document,
    Object.values(surface.nodes).filter((item) => reachable.has(item.id)),
    surface.state,
  )
}
