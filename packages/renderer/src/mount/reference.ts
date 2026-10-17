import { createInstance, validateInstance } from '../protocol/instance'
import { pureTheme } from '../theme-core/themes'
import type { ComponentInstance } from '../protocol/types'

export function isComponentReference(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(value)
}

interface PendingReference {
  controller: AbortController
  result: Promise<ComponentInstance>
  readers: number
}
const pending = new Map<string, PendingReference>()

/** Only concurrent reads are shared. Each mount gets fresh state; later reads fetch the latest version. */
export function loadComponentReference(
  name: string,
  signal: AbortSignal,
): Promise<ComponentInstance> {
  if (!isComponentReference(name)) return Promise.reject(new Error('组件 ID 无效'))
  if (signal.aborted) return Promise.reject(new DOMException('已取消加载', 'AbortError'))
  let entry = pending.get(name)
  if (!entry) {
    const controller = new AbortController()
    entry = { controller, readers: 0, result: readReference(name, controller.signal) }
    pending.set(name, entry)
  }
  const shared = entry
  shared.readers++
  return new Promise((resolve, reject) => {
    let settled = false
    const release = () => {
      if (settled) return false
      settled = true
      signal.removeEventListener('abort', cancel)
      if (--shared.readers === 0) {
        if (pending.get(name) === shared) pending.delete(name)
        shared.controller.abort()
      }
      return true
    }
    const cancel = () => {
      if (release()) reject(new DOMException('已取消加载', 'AbortError'))
    }
    signal.addEventListener('abort', cancel, { once: true })
    shared.result.then(
      (value) => {
        if (!release()) return
        // A consumer must never mutate another component's document, theme or parameters.
        try { resolve(validateInstance(value)) } catch (cause) { reject(cause) }
      },
      (cause) => { if (release()) reject(cause) },
    )
  })
}

/** Same-site public reads only. Host API adapters and Halo credentials are never forwarded. */
async function readReference(name: string, signal: AbortSignal): Promise<ComponentInstance> {
  const response = await fetch(
    `/apis/api.lingui.acanyo.com/v1alpha1/componentembeds/${encodeURIComponent(name)}`,
    {
      method: 'GET',
      credentials: 'omit',
      mode: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    },
  )
  if (!response.ok) {
    if (response.status === 404) throw new Error('组件不存在或未开启公开嵌入')
    throw new Error(`组件加载失败（HTTP ${response.status}），请稍后重试`)
  }
  const data = await response.json()
  if (!data || !Number.isInteger(data.revision) || data.revision < 1)
    throw new Error('组件返回格式无效')
  const instance = createInstance(data.document, data.theme ?? pureTheme)
  return validateInstance({ ...instance, templateId: name, templateVersion: data.revision })
}
