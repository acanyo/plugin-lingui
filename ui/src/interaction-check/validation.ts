import type { CheckIssue, InteractionCheck } from './types'

/** Persisted diagnostics must remain displayable after a refresh, even if storage is malformed. */
export function validInteractionCheck(value: InteractionCheck): boolean {
  const issue = (item: CheckIssue) =>
    !!item &&
    typeof item.nodeId === 'string' &&
    typeof item.message === 'string' &&
    ['error', 'warning'].includes(item.level)
  const issues = (items: CheckIssue[]) =>
    Array.isArray(items) && items.length <= 100 && items.every(issue)
  return (
    !!value &&
    value.schemaVersion === 'lingui.interaction-check/1' &&
    typeof value.checkedAt === 'string' &&
    Number.isFinite(Date.parse(value.checkedAt)) &&
    typeof value.limited === 'boolean' &&
    issues(value.issues) &&
    Array.isArray(value.cases) &&
    value.cases.length <= 81 &&
    value.cases.every(
      (row) =>
        !!row &&
        typeof row.id === 'string' &&
        typeof row.nodeId === 'string' &&
        typeof row.label === 'string' &&
        [
          'initial',
          'local',
          'success',
          'empty',
          'missing',
          'partial',
          'null',
          'failure',
          'recovery',
        ].includes(row.scenario) &&
        ['passed', 'failed', 'skipped'].includes(row.status) &&
        issues(row.issues) &&
        Array.isArray(row.changedPaths) &&
        row.changedPaths.length <= 100 &&
        row.changedPaths.every((path) => typeof path === 'string'),
    )
  )
}
