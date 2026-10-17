const exact = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 })

/** Short labels for plot axes and centers; data tables retain the exact values. */
export function shortChartNumber(value: number) {
  return Math.abs(value) >= 10000 ? compact.format(value) : exact.format(value)
}
