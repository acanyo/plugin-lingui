import type { ChartDatum } from './geometry'

export function gaugeGeometry(value: unknown, min: number, max: number) {
  const actual = typeof value === 'number' && Number.isFinite(value) ? value : min
  const ratio = max > min ? Math.max(0, Math.min(1, (actual - min) / (max - min))) : 0
  const theta = Math.PI * (1 - ratio)
  return {
    actual,
    ratio,
    path: ratio
      ? `M24,112 A88,88 0 0 1 ${112 + 88 * Math.cos(theta)},${112 - 88 * Math.sin(theta)}`
      : '',
  }
}
export function radarGeometry(data: ChartDatum[], maximum: number) {
  const at = (index: number, fraction: number) => {
    const theta = -Math.PI / 2 + (index * Math.PI * 2) / data.length
    return { x: 160 + 100 * fraction * Math.cos(theta), y: 130 + 100 * fraction * Math.sin(theta) }
  }
  const path = (points: { x: number; y: number }[]) =>
    points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ') + ' Z'
  return {
    grid: [0.25, 0.5, 0.75, 1].map((fraction) => path(data.map((_, index) => at(index, fraction)))),
    axes: data.map((_, index) => at(index, 1)),
    labels: data.map((item, index) => ({ ...at(index, 1.2), label: item.label, index: index + 1 })),
    area: path(
      data.map((item, index) =>
        at(index, maximum > 0 ? Math.max(0, Math.min(1, item.value / maximum)) : 0),
      ),
    ),
  }
}
export function heatLevel(value: number, maximum: number) {
  return !maximum || value <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((value / maximum) * 4)))
}
