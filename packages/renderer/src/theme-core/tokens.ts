import type { ThemeTokens } from '../protocol/types'
import { assertSafeJson } from '../protocol/validate'
import { accentForeground } from './contrast'
import { autoDarkColors, autoLightColors } from './auto-palette'
import { validateFontFamily } from '../fonts/validate'
import { fontFamilyName } from '../fonts/runtime'
const colorKeys = [
  'background',
  'surface',
  'text',
  'muted',
  'accent',
  'border',
  'success',
  'danger',
  'line',
] as const
export function validateTheme(input: unknown): ThemeTokens {
  assertSafeJson(input)
  const theme = input as ThemeTokens
  if (!theme || theme.schemaVersion !== 'lingui.theme/1') throw new Error('主题版本不受支持')
  if (
    Object.keys(theme).some(
      (key) =>
        ![
          'schemaVersion',
          'id',
          'name',
          'mode',
          'colors',
          'radius',
          'spacing',
          'iconSize',
          'lineWidth',
          'shadow',
          'font',
          'customFont',
        ].includes(key),
    )
  )
    throw new Error('主题包含未知配置')
  if (
    typeof theme.id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(theme.id) ||
    typeof theme.name !== 'string' ||
    !theme.name.trim() ||
    theme.name.length > 120
  )
    throw new Error('主题名称或标识无效')
  if (
    !['light', 'dark', 'auto'].includes(theme.mode) ||
    !['system', 'serif', 'mono'].includes(theme.font)
  )
    throw new Error('明暗模式或字体无效')
  if (
    !theme.colors ||
    Object.keys(theme.colors).length !== colorKeys.length ||
    colorKeys.some((key) => !/^#[0-9a-fA-F]{6}$/.test(theme.colors[key]))
  )
    throw new Error('颜色必须为六位十六进制色值')
  for (const [key, min, max] of [
    ['radius', 0, 32],
    ['spacing', 4, 40],
    ['iconSize', 12, 40],
    ['lineWidth', 1, 4],
    ['shadow', 0, 3],
  ] as const) {
    if (typeof theme[key] !== 'number' || theme[key] < min || theme[key] > max)
      throw new Error(`${key} 超出允许范围`)
  }
  if (theme.customFont !== undefined) validateFontFamily(theme.customFont)
  return JSON.parse(JSON.stringify(theme))
}
export function tokenStyle(input: ThemeTokens): Record<string, string> {
  const theme = validateTheme(input)
  const colors = theme.mode === 'auto' ? autoLightColors(theme.colors) : theme.colors
  const result: Record<string, string> = {
    colorScheme: theme.mode === 'auto' ? 'var(--lingui-resolved-scheme, light)' : theme.mode,
  }
  // Auto colors resolve through stylesheet variables, so inline tokens do not block dark mode.
  for (const key of colorKeys)
    result[`--lingui-${key}`] =
      theme.mode === 'auto' ? `var(--lingui-resolved-${key}, ${colors[key]})` : colors[key]
  for (const key of ['success', 'danger'] as const) {
    result[`--lingui-on-${key}`] =
      theme.mode === 'auto'
        ? `var(--lingui-resolved-on-${key}, ${accentForeground(colors[key])})`
        : accentForeground(colors[key])
  }
  const foreground = accentForeground(colors.accent)
  result['--lingui-on-accent'] =
    theme.mode === 'auto' ? `var(--lingui-resolved-on-accent, ${foreground})` : foreground
  result['--lingui-accent-hover'] =
    `color-mix(in srgb, var(--lingui-accent) 90%, ${foreground === '#ffffff' ? '#000000' : '#ffffff'})`
  if (theme.mode === 'auto')
    result['--lingui-accent-hover'] =
      `var(--lingui-resolved-accent-hover, ${result['--lingui-accent-hover']})`
  for (const key of ['radius', 'spacing', 'iconSize', 'lineWidth'] as const)
    result[`--lingui-${key}`] = `${theme[key]}px`
  result['--lingui-shadow'] = [
    'none',
    '0 1px 3px light-dark(#0000000a, #00000033), 0 1px 2px light-dark(#00000005, #0000001a)',
    '0 4px 12px -2px light-dark(#0000000f, #0000004d), 0 2px 4px light-dark(#00000005, #00000026)',
    '0 12px 28px -6px light-dark(#0000001a, #00000066), 0 4px 8px -2px light-dark(#00000008, #00000033)',
  ][Math.round(theme.shadow)]!
  result['--lingui-font'] = {
    system:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Songti SC", serif',
    mono: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
  }[theme.font]
  if (theme.customFont)
    result['--lingui-font'] = `"${fontFamilyName(theme.customFont)}", ${result['--lingui-font']}`
  const dark = autoDarkColors(theme.colors)
  for (const key of colorKeys) result[`--lingui-auto-${key}`] = dark[key]
  for (const key of ['success', 'danger'] as const)
    result[`--lingui-auto-on-${key}`] = accentForeground(dark[key])
  result['--lingui-auto-on-accent'] = accentForeground(dark.accent)
  result['--lingui-auto-accent-hover'] =
    `color-mix(in srgb, var(--lingui-accent) 90%, ${accentForeground(dark.accent) === '#ffffff' ? '#000000' : '#ffffff'})`
  return result
}
