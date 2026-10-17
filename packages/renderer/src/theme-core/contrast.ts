/** WCAG relative luminance for a validated six-digit sRGB color. */
export function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(color.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first),
    b = relativeLuminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
/** Choose the higher-contrast label without changing the author's accent. */
export function accentForeground(accent: string): string {
  return contrastRatio(accent, '#ffffff') >= contrastRatio(accent, '#000000')
    ? '#ffffff'
    : '#000000'
}
