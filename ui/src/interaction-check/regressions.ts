import type { InteractionCheck, InteractionCase } from './types'

function failureKey(row: InteractionCase) {
  return JSON.stringify([
    row.nodeId,
    row.event,
    row.scenario,
    row.issues.map((issue) => [issue.nodeId, issue.level, issue.message]).sort(),
  ])
}
/** A presentation-only edit cannot repair existing bindings outside its authorized scope. */
export function newCheckFailures(report: InteractionCheck, baseline?: InteractionCheck) {
  const existing = new Set(baseline?.cases.filter((row) => row.status === 'failed').map(failureKey))
  return report.cases.filter((row) => row.status === 'failed' && !existing.has(failureKey(row)))
}
