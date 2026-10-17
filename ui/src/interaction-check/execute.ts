import {
  createRuntime,
  createEventRuntime,
  eventActions,
  readPath,
  type ComponentNode,
  type ComponentInstance,
  type EventBinding,
  type EventReport,
  type State,
} from '@lingui/renderer'
import {
  apiTargets,
  endpointKey,
  emptyResponse,
  type ApiScenario,
} from '../integrations/scenarios/model'
import { checkViewState } from './view-state'
import type { CasePlan } from './plans'
import type { CheckIssue, InteractionCase } from './types'
import { partialResponse, checkEmptySelection, disabledRequestIssue } from './robustness'

export async function executeCheckCase(
  plan: CasePlan,
  instance: ComponentInstance,
  nodes: Record<string, ComponentNode>,
  initial: State,
  options: { signal?: AbortSignal; rules?: Record<string, ApiScenario>; index: number },
): Promise<InteractionCase> {
  const document = instance.document,
    targets = apiTargets(document)
  const checkAbort = () => {
    if (options.signal?.aborted)
      throw options.signal.reason ?? new DOMException('自检已停止', 'AbortError')
  }
  const { node, event, scenario } = plan
  const issues: CheckIssue[] = [],
    runtime = createRuntime(initial),
    reports: EventReport[] = []
  const binding = node.events?.[event]
  const actions = eventActions({
    ...node,
    action: undefined,
    events: binding ? { [event]: binding } : {},
  })
  const untestable = actions.find(
    (action) =>
      (action.type === 'delay' &&
        actions.reduce((sum, item) => sum + (item.type === 'delay' ? item.ms : 0), 0) > 250) ||
      (action.type === 'callback' && !['lingui.log', 'lingui.notify'].includes(action.name)),
  )
  const row: InteractionCase = {
    id: `case-${options.index}`,
    nodeId: node.id,
    event,
    scenario,
    label: plan.native ? '内置动作' : plan.input !== undefined ? '输入与选择' : '事件动作链',
    status: 'passed',
    issues,
    changedPaths: [],
    ...(plan.input !== undefined
      ? {
          input:
            typeof plan.input === 'string' && !node.options?.length
              ? '[文本输入已省略]'
              : plan.input,
        }
      : {}),
  }
  if (plan.skipReason) {
    row.status = 'skipped'
    issues.push({ nodeId: node.id, level: 'warning', message: plan.skipReason })
    return row
  }
  if (untestable) {
    row.status = 'skipped'
    issues.push({
      nodeId: node.id,
      level: 'warning',
      message:
        untestable.type === 'callback'
          ? `回调 ${untestable.name} 需要在宿主验证，未执行真实 JS。`
          : '此事件包含较长延迟，请在实时预览中手动验证。',
    })
    return row
  }
  const missing = actions.find((action) => {
    if ((action.type !== 'api' && action.type !== 'request') || scenario === 'failure') return false
    const api =
      action.type === 'api'
        ? document.integrations?.apis.find((api) => api.name === action.name)
        : undefined
    const url = action.type === 'request' ? action.url : api?.url
    if (!url) return false // The event runtime reports missing API definitions as errors.
    const key = endpointKey(url, action.type === 'request' ? action.method : api?.method)
    return (
      targets.find((target) => target.key === key)?.example === undefined && !options.rules?.[key]
    )
  })
  if (missing) {
    row.status = 'skipped'
    issues.push({
      nodeId: node.id,
      level: 'warning',
      message: '缺少响应示例；在 API 测试场景中填写响应后重新自检。',
    })
    return row
  }
  let requests = 0
  const host = createEventRuntime(runtime, {
    trace: true,
    inheritRegistered: false,
    apis: Object.fromEntries((document.integrations?.apis ?? []).map((api) => [api.name, api])),
    callbacks: { 'lingui.log': (args) => args, 'lingui.notify': (args) => args },
    requests: {
      allow: () => true,
      fetch: async (url, init) => {
        checkAbort()
        const key = endpointKey(String(url), init?.method),
          target = targets.find((target) => target.key === key),
          rule = options.rules?.[key]
        requests++
        if (scenario === 'failure' || (scenario === 'recovery' && requests === 1))
          return new Response(JSON.stringify({ message: '自检模拟请求失败' }), { status: 503 })
        const sample = rule ? rule.success : target?.example
        if (sample === undefined) throw new Error('缺少接口响应示例')
        return new Response(
          JSON.stringify(
            scenario === 'empty'
              ? rule
                ? rule.empty
                : emptyResponse(sample)
              : scenario === 'missing'
                ? {}
                : scenario === 'null'
                  ? null
                  : scenario === 'partial'
                    ? partialResponse(sample)
                    : sample,
          ),
          { status: 200 },
        )
      },
    },
    onEvent: (report) => reports.push(report),
  })
  const cancel = () => host.destroy()
  options.signal?.addEventListener('abort', cancel, { once: true })
  try {
    if (node.disabled && runtime.resolve(node.disabled)) {
      const deadlock = disabledRequestIssue(node, binding, runtime.state)
      if (deadlock) {
        row.status = 'failed'
        issues.push(deadlock)
        return row
      }
      row.status = 'skipped'
      issues.push({
        nodeId: node.id,
        level: 'warning',
        message: '当前输入条件下控件禁用，未强行触发。请在预览中输入有效值后验证。',
      })
      return row
    }
    if (
      plan.input !== undefined &&
      node.value &&
      typeof node.value === 'object' &&
      'path' in node.value
    )
      runtime.set(node.value, plan.input)
    if (plan.native && node.action) runtime.dispatch(node.action)
    // Each native click also runs its custom event, as it does in the rendered control.
    const tested = binding
      ? { ...node, events: { [event]: { ...binding, debounceMs: 0 } as EventBinding } }
      : node
    const payload = {
      value: plan.input ?? (node.value ? (runtime.resolve(node.value) ?? null) : null),
      previousValue: node.value ? (createRuntime(initial).resolve(node.value) ?? null) : null,
      text: typeof plan.input === 'string' ? plan.input : '',
      key: 'Enter',
      ...(event === 'confirm' || event === 'cancel' ? { confirmed: event === 'confirm' } : {}),
      ...(event === 'open' || event === 'close'
        ? { open: event === 'open', visible: event === 'open' }
        : {}),
    }
    await host.fire(tested, event, event === 'mount' ? null : payload)
    if (scenario === 'recovery') {
      issues.push(...checkViewState(nodes, runtime))
      if (binding?.loadingPath && readPath(runtime.state, binding.loadingPath) !== false)
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: '请求失败后仍在加载，无法重新发起请求。',
        })
      if (node.disabled && runtime.resolve(node.disabled))
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: '请求失败后按钮仍被禁用，无法重试。',
        })
      reports.length = 0
      if (plan.native && node.action) runtime.dispatch(node.action)
      await host.fire(tested, event, event === 'mount' ? null : payload)
      if (binding?.errorPath && readPath(runtime.state, binding.errorPath))
        issues.push({
          nodeId: node.id,
          level: 'error',
          message: '重试成功后仍保留旧错误，请清除错误状态。',
        })
    }
    checkAbort()
    const terminal = reports.filter((report) => !report.scope || report.scope === 'event').at(-1)
    const failures = reports.filter(
      (report) => report.phase === 'error' && report.scope === 'action',
    )
    const injectedFailure =
      scenario === 'failure' &&
      reports.some((report) => report.scope === 'request' && report.http?.status === 503)
    for (const failure of failures) {
      if (
        injectedFailure &&
        failure.branch === 'actions' &&
        ['api', 'request'].includes(failure.actionType ?? '')
      )
        continue
      issues.push({ nodeId: node.id, level: 'error', message: failure.error ?? '事件执行失败' })
    }
    if (terminal?.phase === 'error' && !failures.length)
      issues.push({ nodeId: node.id, level: 'error', message: terminal.error ?? '事件执行失败' })
    if (injectedFailure && !binding?.errorPath && !binding?.onError?.length)
      issues.push({
        nodeId: node.id,
        level: 'warning',
        message: '请求失败仅显示运行时错误，建议添加错误状态或重试提示。',
      })
    if (binding?.loadingPath && readPath(runtime.state, binding.loadingPath) !== false)
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: `交互结束后 ${binding.loadingPath} 未恢复为 false。`,
      })
    if (injectedFailure && binding?.errorPath && !readPath(runtime.state, binding.errorPath))
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: `请求失败后 ${binding.errorPath} 没有错误信息。`,
      })
    issues.push(...checkViewState(nodes, runtime))
    if (['click', 'submit', 'confirm'].includes(event))
      issues.push(...checkEmptySelection(nodes, initial, runtime.state, node.id))
    row.changedPaths = [
      ...new Set(
        reports.flatMap((report) => report.stateChanges?.map((change) => change.path) ?? []),
      ),
    ]
    row.status = issues.some((issue) => issue.level === 'error') ? 'failed' : 'passed'
  } catch (cause) {
    checkAbort()
    issues.push({
      nodeId: node.id,
      level: 'error',
      message: cause instanceof Error ? cause.message : '交互运行失败',
    })
    row.status = 'failed'
  } finally {
    options.signal?.removeEventListener('abort', cancel)
    host.destroy()
  }
  return row
}
