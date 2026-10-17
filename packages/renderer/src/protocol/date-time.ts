/** Convert ISO values to native picker values; reject invalid calendar dates. */
export function dateInputValue(value: unknown, date: boolean, time: boolean): string {
  if (typeof value !== 'string' || !value) return ''
  const datePart = value.slice(0, 10)
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return ''
    const parsed = new Date(`${datePart}T00:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart)
      return ''
  }
  if (date && !time) return value === datePart ? datePart : ''
  if (!date && time) return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value) ? value : ''
  if (!date || !time) return ''
  if (
    !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?(Z|[+-](0\d|1[0-4]):[0-5]\d)?$/.test(
      value,
    )
  )
    return ''
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`
}
