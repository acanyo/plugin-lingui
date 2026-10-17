import type { ComponentNode } from '../../protocol/types'

function scale(values: number[], lowPixel: number, highPixel: number) {
  const low = Math.min(0, ...values),
    high = Math.max(0, ...values)
  const range = high - low || 1
  return {
    low,
    high,
    at: (value: number) => lowPixel + ((value - low) / range) * (highPixel - lowPixel),
  }
}
export function scatterGeometry(points: NonNullable<ComponentNode['points']>) {
  const x = scale(
    points.map((point) => point.x),
    40,
    320,
  )
  const y = scale(
    points.map((point) => point.y),
    176,
    20,
  )
  return {
    x,
    y,
    points: points.map((point) => ({ ...point, cx: x.at(point.x), cy: y.at(point.y) })),
  }
}
export function waterfallGeometry(data: NonNullable<ComponentNode['data']>) {
  let total = 0
  const steps = data.map((item) => {
    const start = total
    total += item.value
    return { ...item, start, end: total, total: false }
  })
  steps.push({ label: '合计', value: total, start: 0, end: total, total: true })
  const y = scale(
    steps.flatMap((item) => [item.start, item.end]),
    176,
    20,
  )
  const width = 280 / steps.length
  return {
    total,
    zero: y.at(0),
    low: y.low,
    high: y.high,
    steps: steps.map((item, index) => ({
      ...item,
      x: 40 + width * index + width * 0.15,
      width: width * 0.7,
      y: Math.min(y.at(item.start), y.at(item.end)),
      height: Math.max(1, Math.abs(y.at(item.start) - y.at(item.end))),
    })),
  }
}
