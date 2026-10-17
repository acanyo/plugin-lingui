import type { InteractionCallback, InteractionHost } from './types'
const callbacks = new Map<string, InteractionCallback>()
let requests: InteractionHost['requests']
export function registerInteractionRequests(
  adapter: NonNullable<InteractionHost['requests']>,
): () => void {
  if (requests) throw new Error('API 请求适配器已经注册')
  requests = adapter
  return () => {
    if (requests === adapter) requests = undefined
  }
}
export function registeredInteractionRequests() {
  return requests
}
export function registerInteractionCallback(
  name: string,
  callback: InteractionCallback,
): () => void {
  if (
    !/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(name) ||
    ['constructor', 'prototype', '__proto__'].includes(name)
  )
    throw new Error('JS 回调名称格式无效')
  if (callbacks.has(name)) throw new Error(`JS 回调「${name}」已经注册`)
  callbacks.set(name, callback)
  return () => {
    if (callbacks.get(name) === callback) callbacks.delete(name)
  }
}
export function registeredInteractionCallbacks(): Record<string, InteractionCallback> {
  return Object.fromEntries(callbacks)
}
