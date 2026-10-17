export interface ChartDatum {
  label: string
  value: number
}

/** Shared fixed view box; values are normalized, including flat and single-point series. */
export function lineGeometry(data: ChartDatum[]) {
  const low = Math.min(0, ...data.map((item) => item.value))
  const high = Math.max(0, ...data.map((item) => item.value))
  const range = high - low || 1
  const points = data.map((item, index) => ({
    x: data.length === 1 ? 160 : 24 + (index / (data.length - 1)) * 272,
    y: 148 - ((item.value - low) / range) * 128,
  }))
  return {
    low,
    high,
    points,
    path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '),
  }
}

/** Two arcs also render an exact 100% segment without the SVG full-circle ambiguity. */
export function donutGeometry(data: ChartDatum[]) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let angle = -Math.PI / 2
  const at = (theta: number) => `${100 + 72 * Math.cos(theta)},${100 + 72 * Math.sin(theta)}`
  const segments = data.map((item) => {
    if (!total || !item.value) return ''
    const end = angle + (item.value / total) * Math.PI * 2
    const path = `M${at(angle)} A72,72 0 0 1 ${at((angle + end) / 2)} A72,72 0 0 1 ${at(end)}`
    angle = end
    return path
  })
  return { total, segments }
}
