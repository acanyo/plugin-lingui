import {
  createRuntime,
  type ComponentNode,
  type ComponentEventName,
  type JsonValue,
  type State,
} from '@lingui/renderer'
import { inputSamples } from './inputs'
import type { InteractionCase } from './types'

export interface CasePlan {
  node: ComponentNode
  event: ComponentEventName
  scenario: InteractionCase['scenario']
  input?: JsonValue
  native?: boolean
  skipReason?: string
}
const remoteScenarios = [
  'success',
  'empty',
  'missing',
  'partial',
  'null',
  'failure',
  'recovery',
] as const
export function interactionPlans(nodes: Record<string, ComponentNode>, initial: State): CasePlan[] {
  const plans: CasePlan[] = []
  for (const node of Object.values(nodes)) {
    const nativeEvent = node.component === 'LingUI.Popconfirm' ? 'confirm' : 'click'
    if (node.action) {
      const remote = node.events?.[nativeEvent]?.actions.some(
        (action) => action.type === 'api' || action.type === 'request',
      )
      for (const scenario of remote ? remoteScenarios : (['local'] as const))
        plans.push({ node, event: nativeEvent, scenario, native: true })
    }
    let samples: JsonValue[] = []
    try {
      samples = inputSamples(node, createRuntime(initial))
    } catch {
      /* Initial view check reports invalid bindings. */
    }
    for (const sample of samples)
      plans.push({ node, event: 'change', scenario: 'local', input: sample })
    for (const [name, binding] of Object.entries(node.events ?? {})) {
      const event = name as ComponentEventName
      if ((event === 'change' && samples.length) || (event === nativeEvent && node.action)) continue
      const remote = binding.actions.some(
        (action) => action.type === 'api' || action.type === 'request',
      )
      for (const scenario of remote ? remoteScenarios : (['local'] as const))
        plans.push({
          node,
          event,
          scenario,
          ...(![
            'click',
            'enter',
            'search',
            'retry',
            'confirm',
            'cancel',
            'open',
            'close',
            'change',
            'focus',
            'blur',
            'input',
            'load',
            'mount',
            'error',
          ].includes(event)
            ? { skipReason: '此事件依赖组件的特定载荷或表单作用域，请在实时预览中触发验证。' }
            : {}),
        })
    }
  }
  // Include remote change handlers for each sampled value in all response scenarios.
  return plans.flatMap((plan) =>
    plan.input !== undefined &&
    plan.node.events?.change?.actions.some(
      (action) => action.type === 'api' || action.type === 'request',
    )
      ? remoteScenarios.map((scenario) => ({ ...plan, scenario }))
      : [plan],
  )
}
