import type { EmbedClient } from './client'

/** Insertion and copy use the same explicit public-read boundary. */
export async function ensurePublicEmbed(
  client: EmbedClient,
  name: string,
  canManage: boolean,
  signal: AbortSignal,
) {
  const status = await client.status(name, signal)
  if (signal.aborted) throw new DOMException('操作已取消', 'AbortError')
  if (status.enabled) return status
  if (!canManage) throw new Error('该项目尚未开启公开嵌入，请联系拥有组件管理权限的管理员开启')
  const enabled = await client.enable(name, signal)
  if (signal.aborted) throw new DOMException('操作已取消', 'AbortError')
  if (!enabled.enabled) throw new Error('公开嵌入未开启，请重试')
  return enabled
}
