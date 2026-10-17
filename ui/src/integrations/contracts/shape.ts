import type { JsonValue } from '@lingui/renderer'
export interface ShapeChange {
  path: string
  kind: 'missing' | 'type' | 'added'
  before?: string
  after?: string
}
const escape = (key: string) => key.replace(/~/g, '~0').replace(/\//g, '~1')
const labels: Record<string, string> = {
  object: '对象',
  array: '数组',
  string: '字符串',
  number: '数字',
  boolean: '布尔值',
  null: 'null',
}
export function describeTypes(types: Set<string>) {
  return [...types]
    .sort()
    .map((type) => labels[type] ?? type)
    .join(' / ')
}
/** Compare shapes only; values never enter diagnostics or persistent history. */
export function responseChanges(expected: JsonValue, actual: JsonValue): ShapeChange[] {
  const flatten = (input: JsonValue) => {
    const result = new Map<string, Set<string>>(),
      emptyArrays = new Set<string>()
    function visit(value: JsonValue, path: string, depth: number) {
      if (depth > 10 || result.size >= 500) return
      const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
      const types = result.get(path) ?? new Set<string>()
      types.add(type)
      result.set(path, types)
      if (!value || typeof value !== 'object') return
      if (Array.isArray(value)) {
        if (!value.length) emptyArrays.add(path)
        for (const item of value.slice(0, 50))
          visit(item, `${path === '/' ? '' : path}/*`, depth + 1)
      } else
        for (const [key, item] of Object.entries(value).slice(0, 100)) {
          if (!['__proto__', 'constructor', 'prototype'].includes(key))
            visit(item, `${path === '/' ? '' : path}/${escape(key)}`, depth + 1)
        }
    }
    visit(input, '/', 0)
    return { result, emptyArrays }
  }
  const before = flatten(expected),
    after = flatten(actual),
    changes: ShapeChange[] = []
  const suppressed = new Set(after.emptyArrays)
  const descendant = (path: string) =>
    [...suppressed].some((parent) =>
      parent === '/' ? path !== '/' : path.startsWith(`${parent}/`),
    )
  for (const [path, types] of before.result) {
    if (descendant(path)) continue
    const found = after.result.get(path)
    if (!found) {
      changes.push({ path, kind: 'missing', before: describeTypes(types) })
      suppressed.add(path)
    } else if ([...found].some((type) => !types.has(type))) {
      changes.push({
        path,
        kind: 'type',
        before: describeTypes(types),
        after: describeTypes(found),
      })
      suppressed.add(path)
    }
    if (changes.length >= 100) break
  }
  for (const [path, types] of after.result) {
    if (changes.length >= 100) break
    if (!before.result.has(path) && !descendant(path)) {
      changes.push({ path, kind: 'added', after: describeTypes(types) })
      suppressed.add(path)
    }
  }
  return changes
}
