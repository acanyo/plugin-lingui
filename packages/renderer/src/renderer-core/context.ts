import { getContext, setContext } from 'svelte'
import { readable, type Readable } from 'svelte/store'
import type { Dynamic, JsonValue, State, Surface } from '../protocol/types'
import type { Runtime } from '../interaction-runtime/runtime'
import type { EventRuntime } from '../events/runtime'
export interface RendererContext {
  surface: Surface
  runtime: Runtime
  events: EventRuntime
  busy: Readable<Set<string>>
  state: Readable<State>
  prefix: string
  report: (error: unknown) => void
  resolve: (value: Dynamic | undefined) => JsonValue | undefined
}
const rendererKey = Symbol('LingUI Renderer')
export function provideRenderer(
  surface: Surface,
  runtime: Runtime,
  prefix: string,
  report: RendererContext['report'],
  events: EventRuntime,
) {
  const state = readable(runtime.state, (set) => runtime.subscribe(set))
  const busy = readable(new Set<string>(), (set) => events.subscribe(set))
  function resolve(value: Dynamic | undefined): JsonValue | undefined {
    try {
      return runtime.resolve(value)
    } catch (error) {
      report(error)
      return '计算暂不可用'
    }
  }
  setContext<RendererContext>(rendererKey, {
    surface,
    runtime,
    state,
    prefix,
    report,
    resolve,
    events,
    busy,
  })
}
export function useRenderer(): RendererContext {
  const context = getContext<RendererContext>(rendererKey)
  if (!context) throw new Error('渲染上下文不存在')
  return context
}
