import {
  assertSafeJson,
  eventActions,
  parseSource,
  type JsonValue,
  type LinguiDocument,
} from '@lingui/renderer'

export type ScenarioMode = 'real' | 'success' | 'empty' | 'failure' | 'slow'
export interface ApiTarget {
  key: string
  label: string
  method: string
  url: string
  example?: JsonValue
}
export interface ApiScenario {
  mode: ScenarioMode
  success: JsonValue
  empty: JsonValue
  status: number
  message: string
  delayMs: number
}
export const scenarioLabels: Record<ScenarioMode, string> = {
  real: '原始接口',
  success: '成功响应',
  empty: '空数据',
  failure: '请求失败',
  slow: '慢响应',
}
/** Query arguments share a fixture; different methods, origins and paths remain isolated. */
export function endpointKey(url: string, method = 'GET') {
  const parsed = new URL(url, globalThis.location?.href ?? 'https://localhost/')
  return `${method.toUpperCase()} ${parsed.origin}${parsed.pathname}`
}
export function apiTargets(document?: LinguiDocument): ApiTarget[] {
  if (!document) return []
  const targets = new Map<string, ApiTarget>()
  const add = (url: string, method: string, label: string, example?: JsonValue) => {
    const key = endpointKey(url, method),
      previous = targets.get(key)
    targets.set(key, {
      key,
      url,
      method,
      label: previous ? `${previous.label} / ${label}` : label,
      ...(previous?.example !== undefined
        ? { example: previous.example }
        : example !== undefined
          ? { example }
          : {}),
    })
  }
  for (const api of document.integrations?.apis ?? [])
    add(api.url, api.method, api.label || api.name, api.responseExample)
  for (const node of parseSource(document.source))
    for (const action of eventActions(node))
      if (action.type === 'request' && !targets.has(endpointKey(action.url, action.method)))
        add(action.url, action.method ?? 'GET', node.id)
  return [...targets.values()]
}
export function emptyResponse(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return []
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, emptyResponse(item)]),
    )
  if (typeof value === 'number') return 0
  if (typeof value === 'string') return ''
  if (typeof value === 'boolean') return false
  return null
}
export function defaultScenario(target: ApiTarget): ApiScenario {
  const success: JsonValue =
    target.example === undefined ? {} : JSON.parse(JSON.stringify(target.example))
  return {
    mode: 'real',
    success,
    empty: emptyResponse(success),
    status: 503,
    message: '模拟服务暂时不可用，请重试。',
    delayMs: 2000,
  }
}
export function validateScenario(value: ApiScenario): ApiScenario {
  assertSafeJson(value, false)
  if (!Object.hasOwn(scenarioLabels, value.mode)) throw new Error('请选择有效的测试场景')
  if (!Number.isInteger(value.status) || value.status < 400 || value.status > 599)
    throw new Error('失败状态码需要在 400–599 之间')
  if (!Number.isInteger(value.delayMs) || value.delayMs < 0 || value.delayMs > 60000)
    throw new Error('延迟需要在 0–60000 毫秒之间')
  if (new TextEncoder().encode(JSON.stringify([value.success, value.empty])).length > 60000)
    throw new Error('模拟响应合计不能超过 60 KiB')
  return JSON.parse(JSON.stringify(value)) as ApiScenario
}
