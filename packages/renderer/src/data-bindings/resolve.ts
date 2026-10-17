import capabilities from '../../schemas/binding-capabilities.json'
import type { ComponentNode, State, JsonValue } from '../protocol/types'
import { readPath, segments } from '../interaction-runtime/pointer'
import { validateAdvancedNode } from '../protocol/advanced-validation'
import { validateWorkspaceNode } from '../protocol/workspace-validation'
import { validateProductivityNode } from '../protocol/productivity-validation'
import { validateNode } from '../protocol/generated/validators.js'
export const bindingCapabilities = capabilities as Partial<
  Record<ComponentNode['component'], string[]>
>
export function validateDataBindings(node: ComponentNode) {
  if (!validateNode(node)) throw new Error('数据绑定配置不符合组件字段格式')
  for (const binding of Object.values(node.bindings ?? {})) {
    segments(binding.path)
    for (const mapping of Object.values(binding.map ?? {}))
      for (const path of Array.isArray(mapping) ? mapping : [mapping]) segments(path)
  }
  for (const binding of [node.dataState?.loading, node.dataState?.error])
    if (binding) segments(binding.path)
}
/** Bindings never overwrite structure, event handlers, URLs or executable configuration. */
export function resolveCollectionNode(node: ComponentNode, state: State) {
  const next = { ...node }
  let empty = false
  for (const [key, binding] of Object.entries(node.bindings ?? {})) {
    const source = readPath(state, binding.path)
    if (source === undefined || source === null) {
      Object.assign(next, { [key]: [] })
      empty = true
      continue
    }
    if (!Array.isArray(source)) throw new Error(`数据路径 ${binding.path} 需要数组`)
    if (source.length > 256) throw new Error(`数据路径 ${binding.path} 超过 256 条，请使用分页`)
    const mapped = source.map((record) => {
      if (!binding.map) return record
      return Object.fromEntries(
        Object.entries(binding.map).map(([field, mapping]) => {
          const valueAt = (path: string): JsonValue => {
            const value = readPath(record, path)
            if (value === undefined) throw new Error(`字段映射 ${path} 不存在`)
            return value
          }
          return [field, Array.isArray(mapping) ? mapping.map(valueAt) : valueAt(mapping)]
        }),
      )
    })
    Object.assign(next, { [key]: mapped })
    empty ||= source.length === 0
  }
  if (!validateNode(next)) throw new Error(`组件 ${node.id} 的绑定数据不符合字段格式或数量限制`)
  if (
    next.component === 'LingUI.Table' &&
    next.rows?.some((row) => row.cells.length !== (next.columns?.length ?? 0) - 1)
  )
    throw new Error('绑定的表格行与列数不一致')
  if (
    next.options &&
    new Set(next.options.map((option) => option.value)).size !== next.options.length
  )
    throw new Error('绑定的选项值不能重复')
  validateAdvancedNode(next)
  validateWorkspaceNode(next)
  validateProductivityNode(next)
  return { node: next, empty }
}
