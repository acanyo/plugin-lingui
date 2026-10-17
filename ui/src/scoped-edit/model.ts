import {
  childIds,
  parseSource,
  validateInstance,
  type ComponentInstance,
  type LinguiDocument,
} from '@lingui/renderer'
import { validateGeneratedDesign, type GeneratedDesign } from '../ai-adapter/design-result'
import { designValue } from '../revisions/design-changes'

export interface EditTarget {
  nodeId: string
  scope: 'node' | 'subtree'
}
export interface EditProposal {
  target: EditTarget
  source: ComponentInstance
  design: GeneratedDesign
  state: 'pending' | 'adopted' | 'discarded'
}
const presentation = new Set([
  'text',
  'title',
  'description',
  'label',
  'variant',
  'align',
  'justify',
  'tone',
  'size',
  'padding',
  'gap',
  'maxWidth',
  'minHeight',
  'maxColumns',
  'orientation',
  'direction',
  'fit',
  'ratio',
  'maxHeight',
  'lines',
  'weight',
  'axis',
  'accent',
  'placeholder',
  'hint',
  'prefixText',
  'suffixText',
  'confirmText',
  'cancelText',
  'addText',
  'sourceLabel',
  'targetLabel',
  'xLabel',
  'yLabel',
  'unit',
])
const equal = (a: unknown, b: unknown) => designValue(a) === designValue(b)
export class EditScopeError extends Error {}
export function validateEditTarget(target: EditTarget): EditTarget {
  if (
    !target ||
    typeof target.nodeId !== 'string' ||
    !target.nodeId ||
    !['node', 'subtree'].includes(target.scope)
  )
    throw new Error('局部修改目标无效，请重新选取组件。')
  return { nodeId: target.nodeId, scope: target.scope }
}
export function targetInfo(document: LinguiDocument, target: EditTarget) {
  validateEditTarget(target)
  const nodes = new Map(parseSource(document.source).map((node) => [node.id, node]))
  const node = nodes.get(target.nodeId)
  if (!node || !['node', 'subtree'].includes(target.scope))
    throw new Error('局部修改目标已失效，请重新选取组件。')
  const ids = new Set<string>()
  function visit(id: string) {
    if (ids.has(id)) return
    ids.add(id)
    childIds(nodes.get(id)!).forEach(visit)
  }
  if (target.scope === 'subtree') visit(node.id)
  else ids.add(node.id)
  const path: string[] = []
  function find(id: string, visited = new Set<string>()): boolean {
    if (visited.has(id)) return false
    visited.add(id)
    path.push(id)
    if (id === node!.id) return true
    if (childIds(nodes.get(id)!).some((child) => find(child, visited))) return true
    path.pop()
    return false
  }
  find('root')
  return { node, nodes, ids, path }
}
export function assertEditScope(
  source: ComponentInstance,
  design: GeneratedDesign,
  target: EditTarget,
) {
  const problems = scopeViolations(source, design, target)
  if (problems.length) throw new EditScopeError(`局部修改超出授权范围：\n${problems.join('\n')}`)
}
export function validateEditProposal(proposal: EditProposal): EditProposal {
  if (!proposal || !['pending', 'adopted', 'discarded'].includes(proposal.state))
    throw new Error('局部修改草稿状态无效')
  const source = validateInstance(proposal.source)
  const target = validateEditTarget(proposal.target)
  const design = validateGeneratedDesign(proposal.design)
  assertEditScope(source, design, target)
  return { source, target, design, state: proposal.state }
}
/** Scope is enforced against the original snapshot on every attempt, never just in the prompt. */
export function scopeViolations(
  source: ComponentInstance,
  design: GeneratedDesign,
  target: EditTarget,
): string[] {
  const { nodes, ids } = targetInfo(source.document, target)
  const incoming = new Map(parseSource(design.document.source).map((node) => [node.id, node]))
  const problems: string[] = []
  for (const key of ['schemaVersion', 'title', 'state', 'parameters', 'integrations'] as const)
    if (!equal(source.document[key], design.document[key])) problems.push(`不允许修改作品 ${key}`)
  if (design.theme && !equal(design.theme, source.theme)) problems.push('不允许修改全局主题')
  for (const id of new Set([...nodes.keys(), ...incoming.keys()])) {
    const before = nodes.get(id),
      after = incoming.get(id)
    if (!before || !after) {
      problems.push(`不允许新增或删除组件 ${id}`)
      continue
    }
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const oldValue = before[key as keyof typeof before],
        nextValue = after[key as keyof typeof after]
      if (equal(oldValue, nextValue)) continue
      if (!ids.has(id)) problems.push(`范围外组件 ${id} 的 ${key} 被修改`)
      else if (
        !presentation.has(key) ||
        (oldValue && typeof oldValue === 'object') ||
        (nextValue && typeof nextValue === 'object')
      )
        problems.push(`${id}.${key} 涉及结构、数据绑定或交互，超出本次文字与外观修改范围`)
    }
  }
  return problems.slice(0, 20)
}
export function scopedInstruction(prompt: string, source: ComponentInstance, target: EditTarget) {
  targetInfo(source.document, target)
  const rules = `本次为严格局部修改。目标：${JSON.stringify(target)}。只修改该节点${target.scope === 'subtree' ? '及其原有后代' : '本身'}的静态文字、组件支持的外观与布局属性。保留所有组件 ID、类型、父子引用、事件、绑定、状态、参数、接口和全局主题；不能新增删除节点。按钮文字通常在子节点，请在选取子树时修改。不能通过替换绑定为静态值改变数据来源。返回完整作品，不返回补丁。未支持的局部外观不能通过修改全局主题实现。局部范围优先于此前对话。\n用户要求：\n`
  return rules + prompt.slice(-(4000 - rules.length))
}
