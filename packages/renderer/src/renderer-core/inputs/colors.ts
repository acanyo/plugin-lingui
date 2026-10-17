export interface HsvColor {
  hue: number
  saturation: number
  brightness: number
}

/** Keep the last hue for neutral colors so saturation can be restored naturally. */
export function hexToHsv(hex: string, fallbackHue = 0): HsvColor {
  const [red, green, blue] = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  )
  const maximum = Math.max(red!, green!, blue!)
  const minimum = Math.min(red!, green!, blue!)
  const delta = maximum - minimum
  let hue = fallbackHue
  if (delta) {
    const sector =
      maximum === red
        ? (green! - blue!) / delta
        : maximum === green
          ? (blue! - red!) / delta + 2
          : (red! - green!) / delta + 4
    hue = (sector * 60 + 360) % 360
  }
  return { hue, saturation: maximum ? (delta / maximum) * 100 : 0, brightness: maximum * 100 }
}

export function hsvToHex({ hue, saturation, brightness }: HsvColor): string {
  const h = (((hue % 360) + 360) % 360) / 60
  const s = Math.max(0, Math.min(100, saturation)) / 100
  const v = Math.max(0, Math.min(100, brightness)) / 100
  const chroma = v * s
  const secondary = chroma * (1 - Math.abs((h % 2) - 1))
  const channels =
    h < 1
      ? [chroma, secondary, 0]
      : h < 2
        ? [secondary, chroma, 0]
        : h < 3
          ? [0, chroma, secondary]
          : h < 4
            ? [0, secondary, chroma]
            : h < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary]
  return (
    '#' +
    channels
      .map((channel) =>
        Math.round((channel + v - chroma) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

export const colorPresets = [
  { name: '白色', value: '#ffffff' },
  { name: '灰色', value: '#64748b' },
  { name: '黑色', value: '#171717' },
  { name: '红色', value: '#ef4444' },
  { name: '橙色', value: '#f97316' },
  { name: '黄色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '青色', value: '#14b8a6' },
  { name: '天蓝色', value: '#0ea5e9' },
  { name: '蓝色', value: '#2563eb' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
] as const
