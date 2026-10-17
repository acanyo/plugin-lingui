import type {
  Action,
  Binding,
  Dynamic,
  JsonValue,
  LocalAction,
  State,
} from '../protocol/types'
import { evaluate } from './expression'
import { readPath, writePath } from './pointer'
export function createRuntime(initial: State) {
  const snapshot: State = JSON.parse(JSON.stringify(initial))
  let state: State = JSON.parse(JSON.stringify(snapshot))
  const subscribers = new Set<(state: State) => void>()
  function commit(next: State) {
    state = next
    subscribers.forEach((subscriber) => subscriber(state))
  }
  function dispatch(action: Action) {
    if (action.functionCall?.call !== 'lingui.dispatch') throw new Error('此动作未被允许')
    const actions = action.functionCall.args.actions
    if (actions.length > 32) throw new Error('一次最多执行 32 个动作')
    let next: State = JSON.parse(JSON.stringify(state))
    for (const item of actions) next = apply(item, next)
    if (JSON.stringify(next).length > 65536) throw new Error('状态数据超出范围')
    commit(next)
  }
  function apply(action: LocalAction, next: State): State {
    if (action.type === 'reset') return JSON.parse(JSON.stringify(snapshot))
    if (!action.path) throw new Error('请配置动作的状态路径')
    const previous = readPath(next, action.path)
    const value = action.value === undefined ? undefined : evaluate(action.value, next)
    switch (action.type) {
      case 'setState':
      case 'selectOption':
        if (value === undefined) throw new Error('动作缺少值')
        writePath(next, action.path, value)
        break
      case 'toggleState':
        if (typeof previous !== 'boolean') throw new Error('切换需要布尔状态')
        writePath(next, action.path, !previous)
        break
      case 'show':
        writePath(next, action.path, true)
        break
      case 'hide':
        writePath(next, action.path, false)
        break
      case 'increment':
      case 'decrement':
      case 'nextStep':
      case 'previousStep': {
        if (typeof previous !== 'number' || (value !== undefined && typeof value !== 'number'))
          throw new Error('步进需要数字状态')
        const delta = value === undefined ? 1 : Number(value)
        const result =
          previous +
          (action.type === 'decrement' || action.type === 'previousStep' ? -delta : delta)
        if (!Number.isFinite(result)) throw new Error('状态数字超出范围')
        writePath(next, action.path, action.type === 'previousStep' ? Math.max(0, result) : result)
        break
      }
      default:
        throw new Error('不支持的动作')
    }
    return next
  }
  function set(binding: Binding, value: JsonValue) {
    const next: State = JSON.parse(JSON.stringify(state))
    writePath(next, binding.path, value)
    if (JSON.stringify(next).length > 65536) throw new Error('状态数据超出范围')
    commit(next)
  }
  function resolve(value: Dynamic | undefined): JsonValue | undefined {
    if (value === undefined || typeof value !== 'object') return value
    if ('path' in value) return readPath(state, value.path)
    if (value.call !== 'lingui.evaluate' || !('expression' in value.args))
      throw new Error('此计算不在允许的 OpenUI 组件能力范围内')
    return evaluate(value.args.expression, state)
  }
  return {
    get state() {
      return state
    },
    subscribe(callback: (state: State) => void) {
      subscribers.add(callback)
      callback(state)
      return () => {
        subscribers.delete(callback)
      }
    },
    dispatch,
    set,
    resolve,
    reset: () => commit(JSON.parse(JSON.stringify(snapshot))),
  }
}
export type Runtime = ReturnType<typeof createRuntime>
