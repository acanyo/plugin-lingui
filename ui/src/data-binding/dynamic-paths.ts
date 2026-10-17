import type { ComponentNode } from '@lingui/renderer'

export const dynamicProperties = [
  'text',
  'value',
  'title',
  'description',
  'label',
  'tone',
  'disabled',
  'condition',
  'url',
  'expanded',
  'multiple',
] as const
export interface DynamicPath {
  property: (typeof dynamicProperties)[number]
  trail: string[]
  path: string
}
/** Record each binding's location so editing a path preserves the enclosing calculation. */
export function dynamicPaths(node: ComponentNode): DynamicPath[] {
  const found: DynamicPath[] = []
  function visit(
    value: unknown,
    property: DynamicPath['property'],
    trail: string[],
    depth: number,
  ) {
    if (!value || typeof value !== 'object' || depth > 30) return
    if ('path' in value && typeof value.path === 'string')
      found.push({ property, trail, path: value.path })
    for (const [key, child] of Object.entries(value))
      visit(child, property, [...trail, key], depth + 1)
  }
  for (const property of dynamicProperties) visit(node[property], property, [], 0)
  return found
}

export function replaceDynamicPaths(node: ComponentNode, paths: DynamicPath[]): ComponentNode {
  const result = JSON.parse(JSON.stringify(node)) as ComponentNode
  for (const item of paths) {
    if (!item.path.startsWith('/')) throw new Error(`${item.property} 需要以 / 开头的状态路径`)
    let target = result[item.property] as Record<string, unknown>
    for (const part of item.trail) target = target[part] as Record<string, unknown>
    target.path = item.path.trim()
  }
  return result
}
