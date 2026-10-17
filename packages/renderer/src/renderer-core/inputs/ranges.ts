import { dateInputValue } from '../../protocol/date-time'

export function clampNumber(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : min
}
/** Matches the clamped native range value, including negative and fractional bounds. */
export function rangePercent(value: unknown, min: number, max: number) {
  return max > min ? ((clampNumber(value, min, max) - min) / (max - min)) * 100 : 0
}
export function stepNumber(
  value: number,
  direction: number,
  min: number,
  max: number,
  step: number,
) {
  // Round arithmetic residue while retaining practical fractional steps.
  return Math.max(min, Math.min(max, Number((value + direction * step).toPrecision(15))))
}
export function numberRange(value: unknown, min: number, max: number) {
  const range =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as { start?: unknown; end?: unknown })
      : {}
  const start = clampNumber(range.start, min, max),
    end = clampNumber(range.end, min, max)
  return { start: Math.min(start, end), end: Math.max(start, end) }
}
export function dateRange(value: unknown) {
  const range =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as { start?: unknown; end?: unknown })
      : {}
  return {
    start: dateInputValue(range.start, true, false),
    end: dateInputValue(range.end, true, false),
  }
}
export function dateRangeError(range: { start: string; end: string }, min?: string, max?: string) {
  if (range.start && range.end && range.start > range.end) return '结束日期不能早于开始日期。'
  if (
    [range.start, range.end].some(
      (value) => value && ((min && value < min) || (max && value > max)),
    )
  )
    return '日期超出了可选范围。'
  return ''
}
