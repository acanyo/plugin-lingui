import {
  resolveDocument,
  writePath,
  type ComponentNode,
  type JsonValue,
  type LinguiDocument,
} from '@lingui/renderer'
import { replaceSurface } from './document-editor'

/** Initial input values belong to the document; reader interaction stays in the runtime. */
export function updateBoundValue(document: LinguiDocument, node: ComponentNode, value: JsonValue) {
  if (!node.value || typeof node.value !== 'object' || !('path' in node.value))
    throw new Error('此字段没有可编辑的状态绑定')
  const path = node.value.path
  const surface = resolveDocument(document)
  writePath(surface.state, path, value)
  return replaceSurface(
    {
      ...document,
      parameters: document.parameters.map((parameter) =>
        parameter.path === path && typeof value === parameter.type
          ? { ...parameter, default: value as string | number | boolean }
          : parameter,
      ),
    },
    Object.values(surface.nodes),
    surface.state,
  )
}
