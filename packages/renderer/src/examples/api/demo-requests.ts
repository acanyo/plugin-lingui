import { apiExamplePrefix } from './builders'
import type { ApiDefinition } from '../../integrations/types'
import type { InteractionHost } from '../../events/types'
import { articles } from './fixtures'

function exampleUrl(value: string | URL) {
  const base = globalThis.location?.href ?? 'https://localhost/'
  const url = new URL(value, base)
  return url.origin === new URL(base).origin && url.pathname.startsWith(apiExamplePrefix)
    ? url
    : undefined
}

export function isDemoApi(api: Pick<ApiDefinition, 'url'>) {
  try {
    return !!exampleUrl(api.url)
  } catch {
    return false
  }
}

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('已取消', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

/** A per-preview transport: reserved local paths are intercepted, never sent over the network. */
export function createDemoRequests(
  options: { allowReal?: () => boolean; latencyMs?: number } = {},
): NonNullable<InteractionHost['requests']> {
  let healthAttempts = 0
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  return {
    allow: (url) => !!exampleUrl(url) || !!options.allowReal?.(),
    fetch: async (input, init) => {
      const value = input instanceof Request ? input.url : String(input)
      const url = exampleUrl(value)
      if (!url) {
        if (!options.allowReal?.()) throw new Error('当前预览未启用真实 API 请求')
        return globalThis.fetch(input, init)
      }
      await wait(options.latencyMs ?? 450, init?.signal)
      const route = url.pathname.slice(apiExamplePrefix.length)
      const method = init?.method ?? 'GET'
      if (route === 'articles' && method === 'GET') {
        const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase()
        const matches = articles.filter((item) =>
          `${item.name} ${item.summary}`.toLocaleLowerCase().includes(query),
        )
        const page = Number(url.searchParams.get('page') ?? 1)
        const size = Number(url.searchParams.get('pageSize') ?? articles.length)
        if (
          !Number.isInteger(page) ||
          page < 1 ||
          !Number.isInteger(size) ||
          size < 1 ||
          size > 100
        )
          return json({ message: 'page 和 pageSize 需要有效的正整数。' }, 400)
        return json({
          items: matches.slice((page - 1) * size, page * size),
          total: matches.length,
          page,
        })
      }
      if (route === 'stats' && method === 'GET') {
        const period = url.searchParams.get('period') ?? 'week'
        if (!['week', 'month'].includes(period))
          return json({ message: 'period 需要 week 或 month。' }, 400)
        const factor = period === 'month' ? 4 : 1
        return json({
          items: articles.slice(0, 4).map((item, index) => {
            const views = [128, 96, 72, 48][index]! * factor
            return { name: item.name, views, displayViews: String(views) }
          }),
        })
      }
      if (route === 'feedback' && method === 'POST') {
        let body: { name?: unknown; message?: unknown }
        try {
          body = JSON.parse(String(init?.body ?? '{}'))
        } catch {
          return json({ message: '提交内容需要有效 JSON。' }, 400)
        }
        if (
          !body ||
          typeof body.name !== 'string' ||
          body.name.trim().length < 2 ||
          body.name.length > 40 ||
          typeof body.message !== 'string' ||
          body.message.trim().length < 5 ||
          body.message.length > 500
        )
          return json({ message: '称呼需要 2–40 字，建议内容需要 5–500 字。' }, 422)
        return json({ accepted: true, message: '已收到你的建议（模拟回执，未实际保存）。' })
      }
      if (route === 'health' && method === 'GET') {
        if (++healthAttempts === 1)
          return json({ message: '模拟服务暂时不可用，请点击重试。' }, 503)
        return json({
          items: [{ id: 'api', name: '业务接口可用', summary: '请求恢复正常，可以继续操作。' }],
        })
      }
      return json({ message: '此模拟接口或请求方法不存在，请检查案例配置。' }, 404)
    },
  }
}
