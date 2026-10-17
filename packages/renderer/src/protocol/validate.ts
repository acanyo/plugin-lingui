import { validateNode } from './generated/validators.js'
import type { ComponentNode, LinguiDocument, State, Surface } from './types'
import { safeMediaUrl } from './media-url'
import { safeLinkUrl } from './link-url'
import { validateProductivityNode } from './productivity-validation'
import { validateAdvancedNode } from './advanced-validation'
import { validateWorkspaceNode } from './workspace-validation'
import { validatePrimitiveNode } from './primitive-validation'
import { validateInteractionNode } from './interaction-validation'
import { validateDataBindings } from '../data-bindings/resolve'
import { validateIntegrations } from '../integrations/validate'
import { validateNodeEvents } from '../events/validation'
import { dateInputValue } from './date-time'
import { segments } from '../interaction-runtime/pointer'
import { parseSource, referencedIds } from '../openui/source'
import { migrateLegacyDocument } from '../migration/legacy-document'
export { assertSafeJson } from './safe-json'
import { assertSafeJson } from './safe-json'
export const childIds = referencedIds
export function validateDocument(input: unknown): LinguiDocument {
  assertSafeJson(input)
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('请输入灵构 UI 文档对象')
  const document = (
    'schemaVersion' in input && input.schemaVersion === 'lingui.document/1'
      ? migrateLegacyDocument(input)
      : input
  ) as LinguiDocument
  if (
    Object.keys(document).some(
      (key) =>
        !['schemaVersion', 'title', 'source', 'state', 'parameters', 'integrations'].includes(key),
    )
  )
    throw new Error('文档包含未支持的字段')
  if (document.schemaVersion !== 'lingui.document/2')
    throw new Error('文档版本不受支持，需要 lingui.document/2（OpenUI）')
  if (typeof document.title !== 'string' || !document.title.trim() || document.title.length > 120)
    throw new Error('组件名称必须为 1–120 字符')
  if (!document.state || typeof document.state !== 'object' || Array.isArray(document.state))
    throw new Error('界面状态必须是对象')
  if (!Array.isArray(document.parameters) || document.parameters.length > 32)
    throw new Error('组件参数格式无效')
  const keys = new Set<string>()
  for (const parameter of document.parameters) {
    if (
      !parameter ||
      Object.keys(parameter).some(
        (key) => !['key', 'label', 'path', 'type', 'default', 'min', 'max'].includes(key),
      ) ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(parameter.key) ||
      keys.has(parameter.key)
    )
      throw new Error('参数名称重复或格式无效')
    keys.add(parameter.key)
    if (
      !['string', 'number', 'boolean'].includes(parameter.type) ||
      typeof parameter.default !== parameter.type ||
      typeof parameter.label !== 'string' ||
      parameter.label.length > 120
    )
      throw new Error('参数类型或默认值无效')
    segments(parameter.path)
    if (parameter.path === '/') throw new Error('参数不能替换整个状态')
    for (const bound of [parameter.min, parameter.max])
      if (bound !== undefined && (typeof bound !== 'number' || !Number.isFinite(bound)))
        throw new Error('参数范围无效')
    if (parameter.min !== undefined && parameter.max !== undefined && parameter.min > parameter.max)
      throw new Error('参数最小值不能大于最大值')
  }
  validateIntegrations(document.integrations)
  resolveDocument(document)
  return JSON.parse(JSON.stringify(document))
}
export function resolveDocument(document: LinguiDocument): Surface {
  const safe =
    document.schemaVersion === 'lingui.document/2' ? document : migrateLegacyDocument(document)
  const nodes = parseSource(safe.source)
  const surface: Surface = {
    id: 'main',
    nodes: {},
    state: JSON.parse(JSON.stringify(safe.state)) as State,
  }
  for (const node of nodes) {
    if (!validateNode(node))
      throw new Error(
        `组件 ${node.id ?? '未命名'} 的类型或属性不符合目录；请检查未知字段、绑定和动作`,
      )
    surface.nodes[node.id] = node
  }
  let references = 0
  const visit = (id: string, parents: Set<string>) => {
    if (++references > 4096) throw new Error('组件引用展开次数过多')
    if (parents.has(id)) throw new Error(`组件存在循环引用：${id}`)
    if (parents.size > 32) throw new Error('组件树不能超过 32 层')
    const node = surface!.nodes[id]
    if (!node) throw new Error(`组件引用不存在：${id}`)
    if (
      !['DateTimeInput', 'LingUI.DateRange'].includes(node.component) &&
      node.min !== undefined &&
      node.max !== undefined &&
      node.min > node.max
    )
      throw new Error(`节点 ${id} 的数值范围无效`)
    if (
      node.component === 'LingUI.Table' &&
      node.rows?.some((row) => row.cells.length !== node.columns!.length - 1)
    )
      throw new Error(`节点 ${id} 的表格列数不一致`)
    if (
      ['Image', 'Video', 'AudioPlayer', 'LingUI.Avatar'].includes(node.component) &&
      typeof node.url === 'string' &&
      node.url !== '' &&
      !safeMediaUrl(node.url)
    )
      throw new Error(`节点 ${id} 的媒体地址无效，请使用 HTTPS 或站内路径`)
    if (
      node.component === 'LingUI.Link' &&
      typeof node.url === 'string' &&
      node.url !== '' &&
      !safeLinkUrl(node.url)
    )
      throw new Error(`节点 ${id} 的链接地址无效`)
    if (node.items?.some((item) => item.url && !safeLinkUrl(item.url)))
      throw new Error(`节点 ${id} 的导航地址无效`)
    if (
      node.options &&
      new Set(node.options.map((option) => option.value)).size !== node.options.length
    )
      throw new Error(`节点 ${id} 的选项值不能重复`)
    validateAdvancedNode(node)
    validateProductivityNode(node)
    validateWorkspaceNode(node)
    validatePrimitiveNode(node, surface.nodes)
    if (node.component === 'DateTimeInput') {
      if (!node.enableDate && !node.enableTime) throw new Error(`节点 ${id} 至少需要启用日期或时间`)
      for (const bound of [node.min, node.max]) {
        if (bound !== undefined && !dateInputValue(bound, !!node.enableDate, !!node.enableTime))
          throw new Error(`节点 ${id} 的日期时间范围无效`)
      }
      const min = dateInputValue(node.min, !!node.enableDate, !!node.enableTime)
      const max = dateInputValue(node.max, !!node.enableDate, !!node.enableTime)
      if (min && max && min > max) throw new Error(`节点 ${id} 的日期时间范围无效`)
    }
    validateInteractionNode(node)
    validateNodeEvents(node)
    validateDataBindings(node)
    const next = new Set(parents).add(id)
    for (const child of childIds(node)) visit(child, next)
  }
  for (const id of Object.keys(surface.nodes)) visit(id, new Set())
  return surface
}
