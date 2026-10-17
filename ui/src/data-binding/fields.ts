import type { JsonValue } from '@lingui/renderer'
export interface DataField {
  path: string
  type: string
  depth: number
  value: JsonValue
}
const escape = (key: string) => key.replace(/~/g, '~0').replace(/\//g, '~1')
export function fields(value: JsonValue, path = '/', depth = 0): DataField[] {
  const result: DataField[] = []
  function visit(current: JsonValue, pointer: string, level: number) {
    if (result.length >= 500) return
    const type = current === null ? 'null' : Array.isArray(current) ? 'array' : typeof current
    result.push({ path: pointer, type, depth: level, value: current })
    if (level >= 10 || current === null || typeof current !== 'object' || Array.isArray(current))
      return
    for (const [key, child] of Object.entries(current).slice(0, 100)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue
      visit(child, `${pointer === '/' ? '' : pointer}/${escape(key)}`, level + 1)
      if (result.length >= 500) break
    }
  }
  visit(value, path, depth)
  return result
}
