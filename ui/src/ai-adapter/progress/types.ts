import type { GenerationEvent } from '../../api/generated'

export interface GenerationActivity {
  id: string
  label: string
  state: 'running' | 'done' | 'warning' | 'error'
  startedMs: number
  endedMs?: number
}
export interface GenerationTrace {
  activities: GenerationActivity[]
  elapsedMs: number
  outcome: 'running' | 'done' | 'error' | 'stopped'
}
export interface GenerationOptions {
  /** Omit to inherit legacy settings; an empty string selects AI Foundation's default. */
  modelName?: string
  signal?: AbortSignal
  onProgress?: (event: GenerationEvent) => void
}

export function updateTrace(trace: GenerationTrace, event: GenerationEvent): GenerationTrace {
  const next: GenerationTrace = {
    ...trace,
    activities: trace.activities.map((item) => ({ ...item })),
    elapsedMs: Math.max(trace.elapsedMs, event.elapsedMs ?? 0),
  }
  if (event.type === 'activity' && event.id && event.label && event.state) {
    const existing = next.activities.find((item) => item.id === event.id)
    const state = event.state as GenerationActivity['state']
    if (existing) {
      existing.label = event.label
      existing.state = state
      if (state !== 'running') existing.endedMs = event.elapsedMs
    } else if (next.activities.length < 96)
      next.activities.push({
        id: event.id,
        label: event.label,
        state,
        startedMs: event.elapsedMs ?? 0,
        ...(state !== 'running' ? { endedMs: event.elapsedMs } : {}),
      })
  }
  if (event.type === 'error') return finishTrace(next, 'error')
  return next
}
export function finishTrace(
  trace: GenerationTrace,
  outcome: GenerationTrace['outcome'],
): GenerationTrace {
  return {
    ...trace,
    outcome,
    activities: trace.activities.map((item) =>
      item.state === 'running'
        ? {
            ...item,
            state: outcome === 'done' ? 'done' : 'error',
            endedMs: trace.elapsedMs,
          }
        : item,
    ),
  }
}
export function durationLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}
/** History is data, including traces created before the page was refreshed. */
export function validTrace(value: GenerationTrace): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    ['running', 'done', 'error', 'stopped'].includes(value.outcome) &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
    Array.isArray(value.activities) &&
    value.activities.length <= 96 &&
    value.activities.every(
      (item) =>
        typeof item.id === 'string' &&
        item.id.length <= 100 &&
        typeof item.label === 'string' &&
        item.label.length <= 160 &&
        ['running', 'done', 'warning', 'error'].includes(item.state) &&
        Number.isFinite(item.startedMs) &&
        item.startedMs >= 0 &&
        (item.endedMs === undefined || (Number.isFinite(item.endedMs) && item.endedMs >= 0)),
    )
  )
}
