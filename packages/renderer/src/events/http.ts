import type { EventAction, EventReport, InteractionHost } from './types'
import { cloneEventValue, resolveEventValue, type EventValues } from './values'
import { timed } from './async'

export function interactionUrl(
  value: string,
  base = globalThis.location?.href ?? 'https://localhost/',
) {
  if (/^[\\\s]|[\u0000-\u0020\\]/.test(value) || value.startsWith('//'))
    throw new Error('API 地址格式无效')
  const url = new URL(value, base)
  if (
    url.username ||
    url.password ||
    url.hash ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
  )
    throw new Error('API 请使用 HTTPS、站内地址或本地开发地址')
  return url
}
export async function requestAction(
  action: Extract<EventAction, { type: 'request' }>,
  values: EventValues,
  host: InteractionHost,
  signal: AbortSignal,
  observe?: (
    report: Pick<EventReport, 'phase' | 'http' | 'durationMs' | 'result' | 'error'>,
  ) => void,
) {
  const url = interactionUrl(action.url)
  const method = action.method ?? 'GET'
  const query = resolveEventValue(action.query ?? {}, values) as Record<string, unknown>
  for (const [key, value] of Object.entries(query)) {
    if (value === null) continue
    if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, String(item))
    else if (typeof value === 'object') url.searchParams.set(key, JSON.stringify(value))
    else url.searchParams.set(key, String(value))
  }
  if (host.requests && !host.requests.allow(url, method))
    throw new Error('当前宿主的 API 请求规则不允许访问此地址')
  const headers = new Headers({
    Accept: action.response === 'text' ? 'text/plain' : 'application/json',
  })
  for (const [key, value] of Object.entries(
    resolveEventValue(action.headers ?? {}, values) as Record<string, unknown>,
  )) {
    if (
      /^(authorization|proxy-authorization|cookie|set-cookie|host|origin|referer|sec-|x-halo-)/i.test(
        key,
      )
    )
      throw new Error('认证信息由宿主请求适配器提供，请勿写入作品')
    if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error('请求头必须是单行文字')
    headers.set(key, value)
  }
  let body: string | undefined
  if (action.body !== undefined) {
    if (method === 'GET') throw new Error('GET 请求请使用查询参数')
    body = JSON.stringify(resolveEventValue(action.body, values))
    headers.set('Content-Type', 'application/json')
  }
  const started = performance.now()
  let status: number | undefined
  const http = () => ({ method, url: url.toString(), ...(status !== undefined ? { status } : {}) })
  observe?.({ phase: 'start', http: http() })
  return timed(
    async (requestSignal) => {
      let response: Response
      try {
        response = await (host.requests?.fetch ?? globalThis.fetch)(url.toString(), {
          method,
          headers,
          body,
          signal: requestSignal,
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
        })
      } catch (cause) {
        if (requestSignal.aborted) throw requestSignal.reason
        throw new Error(
          `API 网络请求失败，请检查地址、网络或跨域（CORS）配置${cause instanceof Error ? '：' + cause.message : ''}`,
        )
      }
      status = response.status
      if (Number(response.headers.get('Content-Length') ?? 0) > 262144)
        throw new Error('API 响应超过 256 KiB')
      const reader = response.body?.getReader()
      let text = ''
      if (reader) {
        const decoder = new TextDecoder()
        let bytes = 0
        try {
          while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            bytes += chunk.value.byteLength
            if (bytes > 262144) throw new Error('API 响应超过 256 KiB')
            text += decoder.decode(chunk.value, { stream: true })
          }
          text += decoder.decode()
        } finally {
          await reader.cancel().catch(() => undefined)
          reader.releaseLock()
        }
      } else text = await response.text()
      if (!response.ok) {
        let detail = ''
        try {
          const error = JSON.parse(text)
          detail = String(error.detail ?? error.message ?? '').slice(0, 500)
        } catch {
          /* HTTP status remains useful for non-JSON errors. */
        }
        throw new Error(`API 请求失败（HTTP ${response.status}）${detail ? '：' + detail : ''}`)
      }
      if (response.status === 204 || !text.trim()) return null
      if (action.response === 'text') return cloneEventValue(text)
      try {
        return cloneEventValue(JSON.parse(text))
      } catch (cause) {
        if (cause instanceof SyntaxError) throw new Error('API 响应不是有效 JSON')
        throw cause
      }
    },
    signal,
    action.timeoutMs ?? 15000,
  )
    .then((result) => {
      observe?.({
        phase: 'success',
        http: http(),
        result,
        durationMs: Math.round(performance.now() - started),
      })
      return result
    })
    .catch((cause) => {
      observe?.({
        phase: signal.aborted ? 'cancelled' : 'error',
        http: http(),
        error: cause instanceof Error ? cause.message : 'API 请求失败',
        durationMs: Math.round(performance.now() - started),
      })
      throw cause
    })
}
