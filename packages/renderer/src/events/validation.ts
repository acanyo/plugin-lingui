import type { ComponentNode } from '../protocol/types'
import { segments } from '../interaction-runtime/pointer'
import { interactionUrl } from './http'
import { supportedEvents } from './capabilities'
import type { JsonValue } from '../protocol/types'
function validateParameters(value: JsonValue | undefined): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach(validateParameters)
    return
  }
  const keys = Object.keys(value)
  if (keys.length === 1 && ['$state', '$event', '$result', '$error'].includes(keys[0]!)) {
    const path = value[keys[0]!]
    if (typeof path !== 'string') throw new Error('事件参数引用需要有效状态路径')
    segments(path)
    return
  }
  Object.values(value).forEach(validateParameters)
}
export function validateNodeEvents(node: ComponentNode) {
  for (const [event, binding] of Object.entries(node.events ?? {})) {
    if (!supportedEvents(node.component).includes(event as never))
      throw new Error(`组件 ${node.component} 不支持 ${event} 事件`)
    for (const path of [binding.loadingPath, binding.errorPath, binding.resultPath]) {
      if (path !== undefined && !segments(path).length) throw new Error('事件状态路径不能是根节点')
    }
    for (const action of [
      ...binding.actions,
      ...(binding.onSuccess ?? []),
      ...(binding.onError ?? []),
    ]) {
      if (action.type === 'request')
        [action.query, action.headers, action.body].forEach(validateParameters)
      if (action.type === 'callback' || action.type === 'api') validateParameters(action.args)
      if (action.type === 'emit') validateParameters(action.detail)
      if (
        'resultPath' in action &&
        action.resultPath !== undefined &&
        !segments(action.resultPath).length
      )
        throw new Error('事件结果路径不能是根节点')
      if (action.type === 'request') {
        interactionUrl(action.url)
        if ((!action.method || action.method === 'GET') && action.body !== undefined)
          throw new Error('GET 请求请使用查询参数')
        for (const key of Object.keys(action.headers ?? {}))
          if (
            /^(authorization|proxy-authorization|cookie|set-cookie|host|origin|referer|sec-|x-halo-)/i.test(
              key,
            )
          )
            throw new Error('认证信息由宿主提供，请勿写入作品')
      }
      if (action.type === 'local')
        for (const item of action.actions) {
          validateParameters(item.value)
          if (item.type !== 'reset' && (!item.path || !segments(item.path).length))
            throw new Error('事件动作缺少有效状态路径')
          if (['setState', 'selectOption'].includes(item.type) && item.value === undefined)
            throw new Error('事件动作缺少值')
        }
    }
  }
}
