import type { EventReport } from '@lingui/renderer'
export type DebugReport = EventReport & { id: number; time: string }
const sensitive = (key: string) =>
  /password|secret|token|authorization|cookie|credential|apikey|^pat$/i.test(
    key.replace(/[-_]/g, ''),
  )
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 10) return '[嵌套内容已省略]'
  if (typeof value === 'string') {
    let text = value
      .replace(/hmcp_[\w-]+/g, '[已隐藏密钥]')
      .replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [已隐藏密钥]')
      .replace(/([?&](?:access_token|token|api_key|key|password|secret)=)[^&\s]+/gi, '$1[已隐藏]')
    if (/^https?:\/\//.test(text)) {
      try {
        const url = new URL(text)
        for (const key of [...url.searchParams.keys()])
          if (sensitive(key) || key === 'key') url.searchParams.set(key, '[已隐藏]')
        text = url.toString()
      } catch {
        /* Preserve useful non-URL text. */
      }
    }
    return text.length > 6000 ? `${text.slice(0, 6000)}…[内容已截断]` : text
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1))
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    const privatePath = typeof object.path === 'string' && object.path.split('/').some(sensitive)
    return Object.fromEntries(
      Object.entries(object)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          sensitive(key) || (privatePath && ['before', 'after'].includes(key))
            ? '[已隐藏]'
            : sanitize(item, depth + 1),
        ]),
    )
  }
  return value
}
/** Both the on-screen view and JSON export use this sanitized, memory-only record. */
export function sanitizeDiagnostic<T>(value: T): T {
  return sanitize(value) as T
}
export function sanitizeDebugReport(report: EventReport): EventReport {
  const safe = sanitize(report) as EventReport
  if (report.component === 'LingUI.PasswordInput') {
    safe.data = '[已隐藏密码输入]'
    if (safe.result !== undefined) safe.result = '[已隐藏密码输入]'
    safe.stateChanges = safe.stateChanges?.map((change) => ({
      ...change,
      before: '[已隐藏]',
      after: '[已隐藏]',
    }))
  }
  return safe
}
export interface DebugRun {
  id: string
  nodeId: string
  event: EventReport['event']
  time: string
  status: EventReport['phase']
  durationMs?: number
  reports: DebugReport[]
  steps: DebugReport[]
}
export function groupDebugReports(reports: DebugReport[]): DebugRun[] {
  const runs = new Map<string, DebugRun>()
  for (const report of reports) {
    const id = report.runId ?? `legacy-${report.id}`
    const run = runs.get(id) ?? {
      id,
      nodeId: report.nodeId,
      event: report.event,
      time: report.time,
      status: 'start' as const,
      reports: [],
      steps: [],
    }
    run.reports.push(report)
    if (!report.scope || report.scope === 'event') {
      run.status = report.phase
      run.durationMs = report.durationMs
    }
    runs.set(id, run)
  }
  return [...runs.values()].reverse().map((run) => {
    const steps = new Map<string, DebugReport>()
    for (const report of run.reports) {
      const key =
        report.phase === 'emit'
          ? `emit-${report.id}`
          : `${report.scope ?? 'event'}:${report.branch ?? ''}:${report.step ?? ''}`
      steps.set(key, { ...steps.get(key), ...report })
    }
    return { ...run, steps: [...steps.values()] }
  })
}
