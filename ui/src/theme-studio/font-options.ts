import { pureTheme, tokenStyle, type ThemeTokens } from '@lingui/renderer'

export const builtinFontOptions = [
  {
    value: 'system',
    label: '系统无衬线',
    description: '清晰利落 · 适合界面和正文',
    sample: '灵感成形 Design',
  },
  {
    value: 'serif',
    label: '衬线 / 宋体',
    description: '细腻书卷感 · 适合阅读和叙事',
    sample: '灵感成形 Design',
  },
  {
    value: 'mono',
    label: '等宽',
    description: '规整有序 · 适合代码和数据',
    sample: 'Design { 0123 }',
  },
] as const

export function builtinFontStyle(font: ThemeTokens['font']) {
  return { fontFamily: tokenStyle({ ...pureTheme, font })['--lingui-font'] }
}
