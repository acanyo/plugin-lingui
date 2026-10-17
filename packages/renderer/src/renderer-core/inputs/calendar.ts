function utcDate(year: number, month: number, day: number) {
  const date = new Date(0)
  date.setUTCFullYear(year, month, day)
  date.setUTCHours(0, 0, 0, 0)
  return date
}
export function isoDate(date: Date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
export function shiftMonth(month: string, step: number) {
  const [year, number] = month.split('-').map(Number)
  const index = Math.max(12, Math.min(119999, year! * 12 + number! - 1 + step))
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}
export function monthCells(month: string) {
  const [year, number] = month.split('-').map(Number)
  const start = utcDate(year!, number! - 1, 1)
  const offset = (start.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = utcDate(year!, number! - 1, index - offset + 1)
    return {
      date: isoDate(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === number! - 1,
      valid: date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999,
    }
  })
}
export function shiftDay(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = utcDate(year!, month! - 1, day! + days)
  return date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999 ? value : isoDate(date)
}
export function dateInMonth(value: string, month: string) {
  const [year, number] = month.split('-').map(Number)
  const lastDay = utcDate(year!, number!, 0).getUTCDate()
  return `${month}-${String(Math.min(Number(value.slice(-2)), lastDay)).padStart(2, '0')}`
}
