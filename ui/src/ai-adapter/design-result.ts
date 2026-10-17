import {
  assertSafeJson,
  importDocument,
  validateDocument,
  validateTheme,
  type LinguiDocument,
  type ThemeTokens,
} from '@lingui/renderer'

/** Theme choices belong to the generated design, separate from the OpenUI document. */
export interface GeneratedDesign {
  document: LinguiDocument
  theme?: ThemeTokens
}
export function validateGeneratedDesign(input: LinguiDocument | GeneratedDesign): GeneratedDesign {
  assertSafeJson(input)
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('生成的设计格式无效')
  if ('schemaVersion' in input) return { document: validateDocument(input) }
  if (Object.keys(input).some((key) => !['document', 'theme'].includes(key)))
    throw new Error('生成的设计包含未支持的字段')
  return {
    document: validateDocument(input.document),
    ...('theme' in input ? { theme: validateTheme(input.theme) } : {}),
  }
}
export function parseGeneratedDesign(text: string): GeneratedDesign {
  if (new TextEncoder().encode(text).length > 262144) throw new Error('导入文件不能超过 256 KiB')
  const clean = text
    .trim()
    .replace(/^```(?:json|jsonl)?\s*/i, '')
    .replace(/\s*```$/, '')
  let input: unknown
  try {
    input = JSON.parse(clean)
  } catch {
    return { document: importDocument(text) }
  }
  if (input && typeof input === 'object' && !Array.isArray(input) && 'document' in input)
    return validateGeneratedDesign(input as GeneratedDesign)
  return { document: importDocument(text) }
}
