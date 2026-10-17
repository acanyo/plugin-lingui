import { childIds, resolveDocument, readPath, writePath, type LinguiDocument } from '@lingui/renderer'
import { replaceSurface } from './document-editor'

/** Accordion groups own their children and open IDs; each section remains manually editable. */
export function editAccordion(
  document: LinguiDocument,
  id: string,
  operation: 'add' | 'remove' | 'rename' | 'select',
  index = 0,
  title = '',
) {
  const surface = resolveDocument(document),
    node = surface.nodes[id]!
  if (
    node.component !== 'LingUI.Accordion' ||
    !node.sections ||
    !node.value ||
    typeof node.value !== 'object' ||
    !('path' in node.value)
  )
    throw new Error('手风琴配置无效')
  const value = readPath(surface.state, node.value.path)
  let selected = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
  if (operation === 'add') {
    if (node.sections.length >= 12) throw new Error('最多允许 12 个分组')
    const child = `section-${crypto.randomUUID().slice(0, 8)}`
    node.sections.push({ title: `分组 ${node.sections.length + 1}`, child })
    surface.nodes[child] = { id: child, component: 'Column', children: [] }
  } else {
    const section = node.sections[index]
    if (!section) throw new Error('分组不存在')
    if (operation === 'rename') section.title = title
    if (operation === 'remove') {
      if (node.sections.length <= 1) throw new Error('至少保留一个分组')
      node.sections.splice(index, 1)
      selected = selected.filter((child) => child !== section.child)
    }
    if (operation === 'select')
      selected = selected.includes(section.child)
        ? selected.filter((child) => child !== section.child)
        : node.allowMultiple
          ? [...selected, section.child]
          : [section.child]
  }
  writePath(surface.state, node.value.path, selected)
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
