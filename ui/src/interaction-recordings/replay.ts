import {
  createRuntime,
  createEventRuntime,
  eventActions,
  parameterState,
  resolveDocument,
  type ComponentInstance,
  type EventReport,
  type JsonValue,
} from '@lingui/renderer'
import { apiTargets, endpointKey, type ApiScenario } from '../integrations/scenarios/model'
import { cloneJson } from '../shared/clone'
import { canReplay, type RecordingStep } from './model'

/** Uses the renderer's action runtime with a transport that can never reach the network. */
export function createReplay(instance: ComponentInstance, rules: Record<string, ApiScenario> = {}) {
  const source = cloneJson(instance),
    nodes = resolveDocument(source.document).nodes
  const runtime = createRuntime(parameterState(source)),
    reports: EventReport[] = []
  let closed = false,
    missingSample = ''
  const targets = apiTargets(source.document)
  const callbacks = Object.fromEntries(
    (source.document.integrations?.callbacks ?? []).map((item) => [
      item.name,
      (args: JsonValue) => args,
    ]),
  )
  for (const node of Object.values(nodes))
    for (const action of eventActions(node))
      if (action.type === 'callback') callbacks[action.name] = (args: JsonValue) => args
  const events = createEventRuntime(runtime, {
    trace: true,
    inheritRegistered: false,
    callbacks,
    apis: Object.fromEntries(
      (source.document.integrations?.apis ?? []).map((api) => [api.name, api]),
    ),
    requests: {
      allow: () => true,
      fetch: async (url, init) => {
        const key = endpointKey(String(url), init?.method),
          rule = rules[key],
          sample = targets.find((target) => target.key === key)?.example
        // Real-mode rules may contain defaults rather than an explicitly chosen fixture.
        if ((!rule || rule.mode === 'real') && sample === undefined) {
          missingSample = '缺少接口演示响应，请在 API 测试场景中填写并选择模拟响应后重置回放'
          throw new Error(missingSample)
        }
        if (rule?.mode === 'failure')
          return new Response(JSON.stringify({ message: rule.message }), { status: rule.status })
        return new Response(
          JSON.stringify(
            rule && rule.mode !== 'real'
              ? rule.mode === 'empty'
                ? rule.empty
                : rule.success
              : sample,
          ),
          { status: 200 },
        )
      },
    },
    onEvent: (report) => {
      if (!closed) reports.push(report)
    },
  })
  return {
    get state() {
      return cloneJson(runtime.state)
    },
    get reports() {
      return reports
    },
    view(): ComponentInstance {
      return {
        ...source,
        document: { ...source.document, state: cloneJson(runtime.state), parameters: [] },
        parameters: {},
      }
    },
    async step(step: RecordingStep) {
      if (closed) throw new Error('回放已停止，请重置')
      const node = nodes[step.nodeId]
      if (!node || node.component !== step.component || !step.supported || !canReplay(step))
        throw new Error(`${step.nodeId} 的操作无法回放`)
      if (node.disabled && runtime.resolve(node.disabled))
        throw new Error(`${node.id} 当前禁用，步骤未执行`)
      if (node.readOnly && ['input', 'change', 'select', 'clear'].includes(step.event))
        throw new Error(`${node.id} 为只读`)
      const data =
        step.data && typeof step.data === 'object' && !Array.isArray(step.data) ? step.data : {}
      if (
        ['input', 'change', 'select', 'clear'].includes(step.event) &&
        node.value &&
        typeof node.value === 'object' &&
        'path' in node.value &&
        Object.hasOwn(data, 'value')
      )
        runtime.set(node.value, data.value!)
      if (step.event === 'click' && node.action) runtime.dispatch(node.action)
      const offset = reports.length
      const binding = node.events?.[step.event]
      await events.fire(
        binding ? { ...node, events: { [step.event]: { ...binding, debounceMs: 0 } } } : node,
        step.event,
        step.data,
      )
      if (closed) throw new DOMException('已停止回放', 'AbortError')
      if (missingSample) throw new Error(missingSample)
      const terminal = reports
        .slice(offset)
        .filter((report) => !report.scope || report.scope === 'event')
        .at(-1)
      if (terminal?.phase === 'error')
        throw new Error(terminal.error || '事件执行失败；可切换成功场景后重试此步')
    },
    destroy() {
      closed = true
      events.destroy()
    },
  }
}
