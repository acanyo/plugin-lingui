import { createInstance, validateTheme, type ThemeTokens } from '@lingui/renderer'
import { themeControlsDocument } from '../theme-studio/preview-document'
import { createSubmission, type SubmissionDraft } from './submission'

/** Publish a theme snapshot with a portable, interactive specimen for review. */
export function themeSubmission(theme: ThemeTokens, author = ''): SubmissionDraft {
  const safe = validateTheme(theme)
  return {
    ...createSubmission(createInstance({ ...themeControlsDocument(), title: safe.name }, safe)),
    kind: 'theme',
    title: safe.name,
    category: '主题',
    author,
  }
}

export function copyMarketTheme(theme: ThemeTokens): ThemeTokens {
  return { ...validateTheme(theme), id: `theme-${crypto.randomUUID()}` }
}
