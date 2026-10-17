import type { JsonValue, State } from '../protocol/types'
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
export function segments(path: string): string[] {
  if (!path.startsWith('/') || path.length > 160)
    throw new Error('状态路径必须以 / 开头，且不超过 160 字符')
  if (path === '/') return []
  const parts = path
    .slice(1)
    .split('/')
    .map((part) => {
      if (/~(?![01])/.test(part)) throw new Error('状态路径包含无效转义')
      return part.replace(/~1/g, '/').replace(/~0/g, '~')
    })
  if (parts.length > 12 || parts.some((part) => !part || forbidden.has(part)))
    throw new Error('状态路径包含不安全的字段或层级过深')
  return parts
}
export function readPath(state: JsonValue, path: string): JsonValue | undefined {
  let value: JsonValue | undefined = state
  for (const key of segments(path)) {
    if (value === null || typeof value !== 'object') return undefined
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) return undefined
    value = Object.hasOwn(value, key) ? (value as State)[key] : undefined
  }
  return value
}
export function writePath(state: State, path: string, value: JsonValue | undefined): void {
  const keys = segments(path)
  if (!keys.length) throw new Error('动作不能替换整个状态，请使用重置')
  let target: State = state
  for (const key of keys.slice(0, -1)) {
    if (Array.isArray(target) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) > 1024))
      throw new Error('数组下标无效')
    if (!Object.hasOwn(target, key)) target[key] = {}
    const child = target[key]
    if (child === null || typeof child !== 'object') throw new Error('状态路径穿过了非对象字段')
    target = child as State
  }
  const last = keys.at(-1)!
  if (Array.isArray(target) && (!/^(0|[1-9]\d*)$/.test(last) || Number(last) > 1024))
    throw new Error('数组下标无效')
  if (value === undefined) delete target[last]
  else target[last] = value
}
