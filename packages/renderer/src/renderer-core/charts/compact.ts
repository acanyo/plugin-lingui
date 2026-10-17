import type { ChartDatum } from './geometry'
export function progressRing(value: unknown, max: number) {
  const actual = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const ratio = max > 0 ? Math.max(0, Math.min(1, actual / max)) : 0
  const angle = -Math.PI / 2 + ratio * Math.PI * 2
  const at = (theta: number) => `${60 + 46 * Math.cos(theta)},${60 + 46 * Math.sin(theta)}`
  return {
    actual,
    ratio,
    path: ratio
      ? `M60,14 A46,46 0 0 1 ${at((-Math.PI / 2 + angle) / 2)} A46,46 0 0 1 ${at(angle)}`
      : '',
  }
}
export function funnelGeometry(data: ChartDatum[]) {
  const total = data[0]?.value ?? 0
  return data.map((item, index) => {
    const ratio = total > 0 ? item.value / total : 0
    const next = total > 0 ? (data[index + 1]?.value ?? item.value) / total : 0
    return {
      ratio,
      path: `M${(1 - ratio) * 150},2 H${150 + ratio * 150} L${150 + next * 150},38 H${(1 - next) * 150} Z`,
    }
  })
}
