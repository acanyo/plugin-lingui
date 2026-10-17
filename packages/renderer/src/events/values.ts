import type { JsonValue, State } from '../protocol/types'
import { readPath } from '../interaction-runtime/pointer'
import { assertSafeJson } from '../protocol/safe-json'

export interface EventValues {
  state: State
  event: JsonValue
  result: JsonValue
  error: JsonValue
}
/** Explicit placeholders keep literal API JSON separate from expression ASTs. */
export function resolveEventValue(value: JsonValue, context: EventValues, depth = 0): JsonValue {
  if (depth > 24) throw new Error('事件参数嵌套过深')
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => resolveEventValue(item, context, depth + 1))
  for (const key of ['$state', '$event', '$result', '$error'] as const) {
    if (Object.keys(value).length === 1 && typeof value[key] === 'string') {
      const source = context[key.slice(1) as keyof EventValues]
      const path = value[key] as string
      return cloneEventValue(path === '/' ? source : (readPath(source as State, path) ?? null))
    }
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      resolveEventValue(child, context, depth + 1),
    ]),
  )
}
export function cloneEventValue(value: unknown): JsonValue {
  if (value === undefined) return null
  assertSafeJson(value, false)
  return JSON.parse(JSON.stringify(value)) as JsonValue
}
