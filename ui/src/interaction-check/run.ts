import {
  createRuntime,
  parameterState,
  resolveDocument,
  validateInstance,
  type ComponentInstance,
} from '@lingui/renderer'
import { checkContracts } from '../ai-adapter/contract-check'
import type { ApiScenario } from '../integrations/scenarios/model'
import { checkViewState } from './view-state'
import { interactionPlans } from './plans'
import { executeCheckCase } from './execute'
import type { CheckIssue, InteractionCase, InteractionCheck } from './types'
import { sanitizeDiagnostic } from '../component-studio/debug-records'

const unique = (issues: CheckIssue[]) =>
  issues.filter(
    (item, index) =>
      issues.findIndex(
        (other) =>
          other.nodeId === item.nodeId &&
          other.message === item.message &&
          other.level === item.level,
      ) === index,
  )
export const checkFingerprint = (instance: ComponentInstance) =>
  JSON.stringify([instance.document, instance.parameters])
/** Executes only throwaway state and local fixtures. Never calls fetch or registered host callbacks. */
export async function runInteractionCheck(
  input: ComponentInstance,
  options: { signal?: AbortSignal; rules?: Record<string, ApiScenario>; maxCases?: number } = {},
): Promise<InteractionCheck> {
  const checkAbort = () => {
    if (options.signal?.aborted)
      throw options.signal.reason ?? new DOMException('自检已停止', 'AbortError')
  }
  checkAbort()
  const cases: InteractionCase[] = []
  let instance: ComponentInstance
  try {
    instance = validateInstance(input)
  } catch (cause) {
    const issue: CheckIssue = {
      nodeId: 'root',
      level: 'error',
      message: cause instanceof Error ? cause.message : '作品格式无效',
    }
    return sanitizeDiagnostic({
      schemaVersion: 'lingui.interaction-check/1',
      checkedAt: new Date().toISOString(),
      cases: [
        {
          id: 'structure',
          nodeId: 'root',
          scenario: 'initial',
          label: '作品结构',
          status: 'failed',
          issues: [issue],
          changedPaths: [],
        },
      ],
      issues: [issue],
      limited: false,
    })
  }
  const { document } = instance,
    surface = resolveDocument(document),
    initial = parameterState(instance)
  const contractIssues = checkContracts(document).filter((issue) => issue.level === 'error')
  const initialIssues = unique([
    ...contractIssues,
    ...checkViewState(surface.nodes, createRuntime(initial)),
  ])
  cases.push({
    id: 'initial',
    nodeId: 'root',
    scenario: 'initial',
    label: '结构、引用与初始计算',
    status: initialIssues.length ? 'failed' : 'passed',
    issues: initialIssues,
    changedPaths: [],
  })
  const expanded = interactionPlans(surface.nodes, initial)
  const limit = Math.min(Math.max(1, options.maxCases ?? 80), 80)
  const started = performance.now()
  for (const [index, plan] of expanded.slice(0, limit).entries()) {
    checkAbort()
    if (performance.now() - started > 2500) break
    cases.push(
      await executeCheckCase(plan, instance, surface.nodes, initial, { ...options, index }),
    )
  }
  const limited = expanded.length > cases.length - 1
  const issues = unique(cases.flatMap((row) => row.issues))
  if (limited)
    issues.push({
      nodeId: 'root',
      level: 'warning',
      message: `本次自检受场景数或 2.5 秒运行预算限制，剩余交互请手动验证。`,
    })
  return sanitizeDiagnostic({
    schemaVersion: 'lingui.interaction-check/1',
    checkedAt: new Date().toISOString(),
    cases,
    issues,
    limited,
  })
}
