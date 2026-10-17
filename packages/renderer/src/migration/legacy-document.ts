import type { ComponentNode, LinguiDocument, State } from '../protocol/types'
import { writePath } from '../interaction-runtime/pointer'
import { serializeSource } from '../openui/source'
const oldCatalog = 'urn:lingui:catalog:1'
const oldBasic = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'

/** Import-only conversion. Never mounts a legacy renderer or overwrites the source snapshot. */
export function migrateLegacyDocument(input: unknown): LinguiDocument {
  const document = input as { schemaVersion: string; title: string; parameters: LinguiDocument['parameters']; messages: Record<string, any>[] }
  if (document?.schemaVersion !== 'lingui.document/1' || !Array.isArray(document.messages) || document.messages.length > 64)
    throw new Error('旧作品格式无效，无法转换到 OpenUI')
  if (Object.keys(document).some((key) => !['schemaVersion', 'title', 'messages', 'parameters'].includes(key)))
    throw new Error('旧作品包含未知字段，已停止转换')
  const nodes = new Map<string, ComponentNode>()
  let state: State = {}, surface: string | undefined, basic = false
  for (const message of document.messages) {
    if (!['v0.9.1', 'v0.9'].includes(message.version as string) || Object.keys(message).length !== 2)
      throw new Error('旧作品消息协议无效')
    if (message.createSurface) {
      const create = message.createSurface
      if (surface || ![oldCatalog, oldBasic].includes(create.catalogId) || create.sendDataModel || create.theme)
        throw new Error('旧作品目录或状态发送配置不受支持')
      basic = create.catalogId === oldBasic; surface = create.surfaceId
    } else if (message.updateComponents) {
      const update = message.updateComponents
      if (!surface || update.surfaceId !== surface || !Array.isArray(update.components)) throw new Error('旧作品界面无效')
      const seen = new Set<string>()
      for (const item of update.components) {
        if (seen.has(item.id)) throw new Error('旧作品节点 ID 重复')
        seen.add(item.id); nodes.set(item.id, JSON.parse(JSON.stringify(item)))
      }
    } else if (message.updateDataModel) {
      const update = message.updateDataModel
      if (!surface || update.surfaceId !== surface) throw new Error('旧作品界面无效')
      if (!update.path || update.path === '/') {
        if (!update.value || typeof update.value !== 'object' || Array.isArray(update.value)) throw new Error('旧作品状态无效')
        state = JSON.parse(JSON.stringify(update.value))
      } else writePath(state, update.path, update.value)
    } else throw new Error('旧作品消息不受支持，已停止转换')
  }
  if (nodes.size > 256) throw new Error('旧作品节点数量超限')
  if (basic) for (const node of nodes.values()) migrateBasicNode(node, state)
  return { schemaVersion: 'lingui.document/2', title: document.title,
    parameters: document.parameters, source: serializeSource([...nodes.values()]), state }
}

function migrateBasicNode(node: ComponentNode, state: State) {
  // Reject capabilities that cannot be represented rather than silently losing behavior.
  const raw = node as unknown as Record<string, any>
  if (raw.checks?.length || raw.weight !== undefined) throw new Error(`旧组件 ${node.id} 需要手动转换检查规则或布局权重`)
  if (node.children && !Array.isArray(node.children)) throw new Error('旧作品动态列表需要手动转换')
  if (node.component === 'Text' && ['h4', 'h5'].includes(node.variant ?? ''))
    throw new Error(`旧组件 ${node.id} 的标题级别需要手动转换，原作品已保留`)
  if (node.component === 'Button') {
    node.variant = node.variant === 'borderless' ? 'text' : node.variant === 'primary' ? 'primary' : 'secondary'
    const event = raw.action?.event
    if (!event || !['lingui.reset', 'lingui.set', 'lingui.toggle', 'lingui.noop'].includes(event.name))
      throw new Error(`旧组件 ${node.id} 的动作不能安全转换`)
    const context = event.context ?? {}
    const actions = event.name === 'lingui.reset' ? [{ type: 'reset' }]
      : event.name === 'lingui.noop' ? []
      : event.name === 'lingui.set' ? [{ type: 'setState', path: context.path, value: context.value }]
      : [{ type: 'toggleState', path: context.path }]
    // A no-op used as a modal trigger is represented by an empty-state write, never reset.
    if (!actions.length) {
      const path = `/__migration/${node.id}`
      writePath(state, path, false)
      actions.push({ type: 'setState', path, value: false } as never)
    }
    raw.action = { functionCall: { call: 'lingui.dispatch', args: { actions } } }
  }
  if (node.component === 'Slider') { node.min ??= 0; node.label ??= '滑块' }
  if (node.component === 'ChoicePicker') node.label ??= '选择'
  if (node.component === 'DateTimeInput') node.label ??= '日期时间'
  if (['TextField', 'DateTimeInput', 'CheckBox', 'Slider', 'ChoicePicker'].includes(node.component) &&
      (!node.value || typeof node.value !== 'object' || !('path' in node.value))) {
    const path = `/__migration/${node.id}`
    writePath(state, path, (node.value ?? (node.component === 'CheckBox' ? false : '')) as never)
    node.value = { path }
  }
  if (node.component === 'Icon' && !['warning','info','check','code','layers','book','sparkles','arrow','clock','help','cube','database','heap','list','cpu','chevronDown','arrowDown'].includes(String(node.name)))
    throw new Error(`旧图标 ${String(node.name)} 尚未定义等价图标，原作品已保留`)
}
