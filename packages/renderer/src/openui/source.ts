import { parseConfigJson } from './config-json'
import { assertSafeJson } from '../protocol/safe-json'
import { createParser } from '@openuidev/lang-core'
import { componentName, langName, languageLibrary } from './definitions'
import type { ComponentNode } from '../protocol/types'

export interface Statement { name: string; node: ComponentNode; content: string[] }
const parser = createParser(languageLibrary.toJSONSchema())
const statementPattern = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\((.*),\s*\[([A-Za-z0-9_,\s]*)\]\s*\)\s*;?$/

/** A deliberately bounded OpenUI Lang profile: registered components and literal JSON only. */
export function parseSource(source: string): ComponentNode[] {
  if (typeof source !== 'string' || !source.trim() || source.length > 262144)
    throw new Error('OpenUI 源码为空或超过 256 KiB')
  const statements: Statement[] = []
  const names = new Set<string>(), ids = new Set<string>()
  for (const line of source.trim().split('\n')) {
    if (!line.trim()) continue
    const match = statementPattern.exec(line.trim())
    if (!match) throw new Error('OpenUI 语法无效：每行使用 name = Component(JSON配置, [子组件引用])')
    const [, name, type, json, refs] = match as unknown as [string, string, string, string, string]
    const kind = componentName(type)
    if (!kind) throw new Error(`OpenUI 组件类型或属性不符合目录：${type}`)
    if (names.has(name)) throw new Error(`OpenUI 声明重复：${name}`)
    names.add(name)
    let config: Record<string, unknown>
    try { config = parseConfigJson(json) as Record<string, unknown> } catch { throw new Error('OpenUI 组件配置必须是有效 JSON') }
    if (!config || typeof config !== 'object' || Array.isArray(config) || 'component' in config)
      throw new Error('OpenUI 组件配置属性无效')
    assertSafeJson(config)
    const node = { ...config, component: kind } as unknown as ComponentNode
    if ([name, node.id].some((value) => ['__proto__', 'constructor', 'prototype'].includes(value)))
      throw new Error('OpenUI 节点或声明标识不安全')
    if (ids.has(node.id)) throw new Error(`组件节点 ID 重复：${node.id}`)
    ids.add(node.id)
    if ((name === 'root') !== (node.id === 'root')) throw new Error('OpenUI root 声明必须对应 root 节点')
    statements.push({ name, node, content: refs.trim() ? refs.split(',').map((id) => id.trim()) : [] })
    if (statements.length > 256) throw new Error('最多允许 256 个组件节点')
  }
  if (!names.has('root')) throw new Error('组件缺少 root 根节点')
  const byName = new Map(statements.map((statement) => [statement.name, statement]))
  const visiting = new Set<string>(), visited = new Set<string>()
  let expansions = 0
  function visit(name: string, depth = 0) {
    if (++expansions > 4096) throw new Error('组件引用展开次数过多')
    if (depth > 32) throw new Error('组件树不能超过 32 层')
    if (visiting.has(name)) throw new Error(`组件存在循环引用：${name}`)
    const statement = byName.get(name)
    if (!statement) throw new Error(`组件引用不存在：${name}`)
    visiting.add(name); visited.add(name)
    for (const child of statement.content) visit(child, depth + 1)
    visiting.delete(name)
  }
  visit('root')
  if (visited.size !== statements.length) throw new Error('OpenUI 存在未连接到 root 的组件声明')
  // Verify that the visual references match the configuration's editable references.
  for (const statement of statements) {
    const provided = new Set(statement.content.map((name) => byName.get(name)?.node.id))
    for (const id of referencedIds(statement.node))
      if (!provided.has(id)) throw new Error(`组件引用不存在于 OpenUI content：${id}`)
  }
  const parsed = parser.parse(source)
  if (!parsed.root || parsed.meta.incomplete || parsed.meta.errors.length || parsed.meta.unresolved.length)
    throw new Error('OpenUI 解析失败或组件配置不完整')
  return statements.map(({ node }) => node)
}

export function referencedIds(node: ComponentNode): string[] {
  return [...(node.children ?? []), ...(node.child ? [node.child] : []),
    ...(node.trigger ? [node.trigger] : []), ...(node.content ? [node.content] : []),
    ...(node.tabs?.map((tab) => tab.child) ?? []), ...(node.sections?.map((item) => item.child) ?? [])]
}

export function serializeSource(nodes: ComponentNode[]): string {
  const names = new Map(nodes.map((node, index) => [node.id, node.id === 'root' ? 'root' : `n${index}`]))
  const reachable = new Set<string>()
  const lookup = new Map(nodes.map((node) => [node.id, node]))
  function mark(id: string) {
    if (reachable.has(id)) return
    reachable.add(id)
    const node = lookup.get(id)
    if (node) for (const child of referencedIds(node)) mark(child)
  }
  mark('root')
  return nodes.map((node, index) => {
    const { component, ...config } = node
    const refs = [...new Set([...referencedIds(node),
      ...(node.id === 'root' ? nodes.filter((item) => !reachable.has(item.id)).map((item) => item.id) : [])])]
    return `${node.id === 'root' ? 'root' : `n${index}`} = ${langName(component)}(${JSON.stringify(config)}, [${refs.map((id) => names.get(id) ?? `missing_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`).join(', ')}])`
  }).join('\n')
}
