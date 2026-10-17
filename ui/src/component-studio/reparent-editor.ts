import { resolveDocument, validateDocument, writePath, type LinguiDocument } from '@lingui/renderer'
import { replaceSurface } from './document-editor'
export function reparentNode(document: LinguiDocument, id: string, parentId: string) {
  const surface = resolveDocument(document),
    current = surface.nodes[id],
    parent = surface.nodes[parentId]
  if (!current || !parent || id === 'root') throw new Error('请选择可移动的节点与目标布局')
  const old = Object.values(surface.nodes).find((node) => node.children?.includes(id))
  if (!old?.children) throw new Error('只有布局的子节点可以移动；单一内容容器请在数据中修改')
  if (old.id === parentId) return document
  if (old.component === 'LingUI.SplitPane') throw new Error('分栏必须保留两个内容区域')
  if (old.component === 'LingUI.Carousel' && old.children.length <= 1)
    throw new Error('轮播至少保留一页')
  if (parent.component === 'LingUI.Carousel' && (parent.children?.length ?? 0) >= 12)
    throw new Error('轮播最多包含 12 页')
  old.children = old.children.filter((child) => child !== id)
  parent.children = [...(parent.children ?? []), id]
  if (
    old.component === 'LingUI.Carousel' &&
    old.value &&
    typeof old.value === 'object' &&
    'path' in old.value
  )
    writePath(surface.state, old.value.path, 0)
  return validateDocument(replaceSurface(document, Object.values(surface.nodes), surface.state))
}
