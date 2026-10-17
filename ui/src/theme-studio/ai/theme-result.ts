import { validateTheme, type ThemeTokens } from '@lingui/renderer'

export class ThemeGenerationFormatError extends Error {}

export function validateGeneratedTheme(input: unknown): ThemeTokens {
  try {
    return validateTheme(input)
  } catch (cause) {
    throw new ThemeGenerationFormatError(cause instanceof Error ? cause.message : '主题格式无效')
  }
}

export function parseGeneratedTheme(text: string): ThemeTokens {
  if (new TextEncoder().encode(text).length > 262144)
    throw new ThemeGenerationFormatError('主题 JSON 不能超过 256 KiB')
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let input: unknown
  try {
    input = JSON.parse(clean)
  } catch {
    throw new ThemeGenerationFormatError('AI 返回的主题不是完整 JSON')
  }
  return validateGeneratedTheme(input)
}
