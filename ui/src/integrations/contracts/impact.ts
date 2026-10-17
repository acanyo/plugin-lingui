import { eventActions, parseSource, type LinguiDocument } from '@lingui/renderer'
import type { ShapeChange } from './shape'
import { dynamicPaths } from '../../data-binding/dynamic-paths'
export interface BindingImpact {
  nodeId: string
  property: string
  path: string
}
export function apiDestinations(document: LinguiDocument, name: string): string[] {
  const paths = new Set<string>()
  for (const node of parseSource(document.source))
    for (const binding of Object.values(node.events ?? {})) {
      for (const action of eventActions({ ...node, action: undefined, events: { click: binding } }))
        if (action.type === 'api' && action.name === name && action.resultPath)
          paths.add(action.resultPath)
      const last = binding.actions.at(-1)
      if (binding.resultPath && last?.type === 'api' && last.name === name)
        paths.add(binding.resultPath)
    }
  return [...paths]
}
const segments = (path: string) => (path === '/' ? [] : path.split('/').slice(1))
function overlaps(a: string, b: string) {
  const left = segments(a),
    right = segments(b)
  return left
    .slice(0, Math.min(left.length, right.length))
    .every(
      (part, index) =>
        part === right[index] ||
        part === '*' ||
        right[index] === '*' ||
        (/^\d+$/.test(part) && right[index] === '*'),
    )
}
export function affectedBindings(
  document: LinguiDocument,
  name: string,
  change: ShapeChange,
): BindingImpact[] {
  if (change.kind === 'added') return []
  const targets = apiDestinations(document, name).map(
    (base) => `${base === '/' ? '' : base}${change.path === '/' ? '' : change.path}` || '/',
  )
  const impacts: BindingImpact[] = []
  for (const node of parseSource(document.source)) {
    for (const { property, path } of dynamicPaths(node))
      if (targets.some((target) => overlaps(path, target)))
        impacts.push({ nodeId: node.id, property, path })
    for (const [property, binding] of Object.entries(node.bindings ?? {})) {
      if (targets.some((target) => overlaps(binding.path, target)))
        impacts.push({ nodeId: node.id, property: `bindings.${property}`, path: binding.path })
    }
  }
  return impacts
    .filter(
      (item, index) =>
        impacts.findIndex(
          (other) =>
            other.nodeId === item.nodeId &&
            other.property === item.property &&
            other.path === item.path,
        ) === index,
    )
    .slice(0, 80)
}
