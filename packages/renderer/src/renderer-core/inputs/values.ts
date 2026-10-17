/** Runtime state may come from arbitrary local expressions; controls normalize without mutating it. */
export function stringList(value: unknown, limit: number, maxLength = 160): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === 'string' && !!item.trim() && item.length <= maxLength,
          ),
        ),
      ].slice(0, limit)
    : []
}
export function hexColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : undefined
}
export function pageNumber(value: unknown, total: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(total, Math.round(value)))
    : 1
}
export function pageItems(page: number, total: number): (number | 'gap-start' | 'gap-end')[] {
  const visible = [
    ...new Set(
      [1, total, page - 1, page, page + 1].filter((value) => value >= 1 && value <= total),
    ),
  ].sort((a, b) => a - b)
  const result: (number | 'gap-start' | 'gap-end')[] = []
  visible.forEach((value, index) => {
    const previous = visible[index - 1]
    if (previous !== undefined && value - previous === 2) result.push(previous + 1)
    else if (previous !== undefined && value - previous > 2)
      result.push(index === 1 ? 'gap-start' : 'gap-end')
    result.push(value)
  })
  return result
}
