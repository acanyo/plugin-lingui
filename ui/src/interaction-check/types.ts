import type { ComponentEventName, JsonValue } from '@lingui/renderer'
export interface CheckIssue {
  nodeId: string
  message: string
  level: 'error' | 'warning'
}
export interface InteractionCase {
  id: string
  nodeId: string
  event?: ComponentEventName
  scenario:
    | 'initial'
    | 'local'
    | 'success'
    | 'empty'
    | 'missing'
    | 'partial'
    | 'null'
    | 'failure'
    | 'recovery'
  label: string
  status: 'passed' | 'failed' | 'skipped'
  issues: CheckIssue[]
  changedPaths: string[]
  input?: JsonValue
}
export interface InteractionCheck {
  schemaVersion: 'lingui.interaction-check/1'
  checkedAt: string
  cases: InteractionCase[]
  issues: CheckIssue[]
  limited: boolean
}
export interface CheckedDesign {
  report: InteractionCheck
  fingerprint: string
}
