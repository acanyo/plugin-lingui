import type { EventAction, EventBinding, EventReport } from '@lingui/renderer'
export const branches = ['actions', 'onSuccess', 'onError'] as const
export type Branch = (typeof branches)[number]
export const branchLabels: Record<Branch, string> = {
  actions: '按顺序执行',
  onSuccess: '全部成功后',
  onError: '发生错误后',
}
export function moveGraphAction(
  binding: EventBinding,
  branch: Branch,
  index: number,
  delta: number,
): EventBinding {
  const next = JSON.parse(JSON.stringify(binding)) as EventBinding,
    list = next[branch] ?? []
  if (index < 0 || index >= list.length || index + delta < 0 || index + delta >= list.length)
    return next
  ;[list[index], list[index + delta]] = [list[index + delta]!, list[index]!]
  next[branch] = list
  return next
}
export function replaceGraphAction(
  binding: EventBinding,
  branch: Branch,
  index: number,
  action?: EventAction,
): EventBinding {
  const next = JSON.parse(JSON.stringify(binding)) as EventBinding,
    list = next[branch] ?? []
  if (index < 0 || index > list.length || (index === list.length && (!action || list.length >= 16)))
    return next
  if (action) list[index] = action
  else list.splice(index, 1)
  next[branch] = list
  return next
}
export function graphActionSummary(action: EventAction) {
  if (action.type === 'api' || action.type === 'callback') return action.name
  if (action.type === 'request') return `${action.method ?? 'GET'} ${action.url}`
  if (action.type === 'local')
    return action.actions.map((item) => `${item.type} ${item.path ?? ''}`).join('、')
  if (action.type === 'delay') return `${action.ms} ms`
  if (action.type === 'emit') return action.name
  return '不支持编辑的动作（保留原定义）'
}
export function graphStepReport(reports: EventReport[], branch: Branch, index: number) {
  const runId = reports.at(-1)?.runId
  return reports
    .filter(
      (row) =>
        row.runId === runId &&
        row.scope === 'action' &&
        row.branch === branch &&
        row.step === index + 1,
    )
    .at(-1)
}
