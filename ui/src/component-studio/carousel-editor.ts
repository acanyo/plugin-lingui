import { resolveDocument, childIds, readPath, writePath, type LinguiDocument } from '@lingui/renderer'
import { replaceSurface } from './document-editor'
export function editCarousel(
  document: LinguiDocument,
  id: string,
  operation: 'add' | 'remove' | 'select',
  index = 0,
) {
  const surface = resolveDocument(document),
    node = surface.nodes[id]
  if (
    node?.component !== 'LingUI.Carousel' ||
    !node.children ||
    !node.value ||
    typeof node.value !== 'object' ||
    !('path' in node.value)
  )
    throw new Error('轮播配置无效')
  if (operation === 'add') {
    if (node.children.length >= 12) throw new Error('轮播最多包含 12 页')
    const child = `${id}-slide-${crypto.randomUUID().slice(0, 8)}`
    node.children.push(child)
    surface.nodes[child] = { id: child, component: 'Column', children: [`${child}-text`] }
    surface.nodes[`${child}-text`] = {
      id: `${child}-text`,
      component: 'Text',
      text: '新的轮播内容',
    }
  }
  if (operation === 'remove') {
    if (node.children.length <= 1) throw new Error('轮播至少保留一页')
    const child = node.children[index]
    if (!child) throw new Error('轮播页不存在')
    node.children.splice(index, 1)
    const selected = readPath(surface.state, node.value.path)
    writePath(
      surface.state,
      node.value.path,
      Math.max(
        0,
        Math.min(
          node.children.length - 1,
          typeof selected === 'number' ? (selected > index ? selected - 1 : selected) : 0,
        ),
      ),
    )
  }
  if (operation === 'select') {
    if (!Number.isInteger(index) || index < 0 || index >= node.children.length)
      throw new Error('请选择有效轮播页')
    writePath(surface.state, node.value.path, index)
  }
  // Keep only reachable nodes, including nested content and any shared references.
  const reachable = new Set<string>()
  const visit = (id: string) => {
    if (reachable.has(id)) return
    reachable.add(id)
    const item = surface.nodes[id]
    if (!item) return
    childIds(item).forEach(visit)
  }
  visit('root')
  return replaceSurface(
    document,
    Object.values(surface.nodes).filter((item) => reachable.has(item.id)),
    surface.state,
  )
}
