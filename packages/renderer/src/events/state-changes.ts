import type { JsonValue, State } from '../protocol/types'
import type { EventReport } from './types'

/** Arrays are one change; objects expose JSON Pointer paths, including added/deleted keys. */
export function stateChanges(
  before: State,
  after: State,
): NonNullable<EventReport['stateChanges']> {
  const changes: NonNullable<EventReport['stateChanges']> = []
  function visit(old: JsonValue | undefined, next: JsonValue | undefined, path: string) {
    if (JSON.stringify(old) === JSON.stringify(next)) return
    if (
      old &&
      next &&
      typeof old === 'object' &&
      typeof next === 'object' &&
      !Array.isArray(old) &&
      !Array.isArray(next)
    ) {
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)]))
        visit(old[key], next[key], `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`)
    } else
      changes.push({
        path: path || '/',
        ...(old !== undefined ? { before: old } : {}),
        ...(next !== undefined ? { after: next } : {}),
      })
  }
  visit(before, after, '')
  return changes
}
