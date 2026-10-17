import { segments } from '../interaction-runtime/pointer'
export function assertSafeJson(value: unknown, checkPaths = true): void {
  let count = 0
  function visit(current: unknown, depth: number, source = false, literal = !checkPaths) {
    if (++count > 16000 || depth > 48) throw new Error('数据过大或嵌套层级过深')
    if (typeof current === 'number' && !Number.isFinite(current))
      throw new Error('数据包含无效数字')
    if (typeof current === 'string' && current.length > (source ? 262144 : 16000))
      throw new Error('单段文字不能超过 16000 字符')
    if (current && typeof current === 'object') {
      for (const [key, child] of Object.entries(current)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key))
          throw new Error('数据包含不安全的字段')
        if (!literal && key === 'path' && typeof child === 'string') segments(child)
        visit(
          child,
          depth + 1,
          key === 'source' &&
            'schemaVersion' in current &&
            current.schemaVersion === 'lingui.document/2',
          literal || key === 'events' || key === 'state' || key === 'integrations',
        )
      }
    } else if (current !== null && !['string', 'number', 'boolean'].includes(typeof current))
      throw new Error('只允许 JSON 数据')
  }
  visit(value, 0)
  if (new TextEncoder().encode(JSON.stringify(value)).length > 262144)
    throw new Error('组件数据不能超过 256 KiB')
}
