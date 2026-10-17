import type { ThemeTokens } from '../protocol/types'
import { contrastRatio, relativeLuminance } from './contrast'

type Palette = ThemeTokens['colors']
function mix(color: string, target: string, amount: number): string {
  return (
    '#' +
    [1, 3, 5]
      .map((start) => {
        const from = parseInt(color.slice(start, start + 2), 16)
        const to = parseInt(target.slice(start, start + 2), 16)
        return Math.round(from + (to - from) * amount)
          .toString(16)
          .padStart(2, '0')
      })
      .join('')
  )
}
function readable(
  color: string,
  backgrounds: string[],
  minimum: number,
  target = '#ffffff',
): string {
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, target, step / 100)
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= minimum))
      return candidate
  }
  return target
}

/** Only auto mode uses this palette; explicit author colors are never rewritten. */
export function autoDarkColors(colors: Palette): Palette {
  if (relativeLuminance(colors.background) < 0.08 && relativeLuminance(colors.surface) < 0.12)
    return { ...colors }
  const background = mix('#151515', colors.background, 0.025)
  const surface = mix('#242424', colors.surface, 0.025)
  const backgrounds = [background, surface]
  const text = readable(colors.text, backgrounds, 12)
  const muted = readable(colors.muted, backgrounds, 5)
  const border = mix(surface, text, 0.18)
  return {
    background,
    surface,
    text,
    muted,
    accent: readable(colors.accent, backgrounds, 4.5),
    success: readable(colors.success, backgrounds, 4.5),
    danger: readable(colors.danger, backgrounds, 4.5),
    border,
    line: colors.line === colors.border ? border : readable(colors.line, backgrounds, 3),
  }
}

/** A dark starting preset also needs a readable light companion in auto mode. */
export function autoLightColors(colors: Palette): Palette {
  if (relativeLuminance(colors.background) >= 0.08 || relativeLuminance(colors.surface) >= 0.12)
    return { ...colors }
  const background = mix('#ffffff', colors.background, 0.025)
  const surface = mix('#f5f5f5', colors.surface, 0.025)
  const backgrounds = [background, surface]
  const text = readable(colors.text, backgrounds, 12, '#000000')
  const border = mix(surface, text, 0.15)
  return {
    background,
    surface,
    text,
    muted: readable(colors.muted, backgrounds, 5, '#000000'),
    accent: readable(colors.accent, backgrounds, 4.5, '#000000'),
    success: readable(colors.success, backgrounds, 4.5, '#000000'),
    danger: readable(colors.danger, backgrounds, 4.5, '#000000'),
    border,
    line: colors.line === colors.border ? border : readable(colors.line, backgrounds, 3, '#000000'),
  }
}
