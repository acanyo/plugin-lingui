import { validateDocument } from './validate'
import type { LinguiDocument } from './types'
export function importDocument(text: string): LinguiDocument {
  if (new TextEncoder().encode(text).length > 262144) throw new Error('导入文件不能超过 256 KiB')
  const clean = text
    .trim()
    .replace(/^```(?:json|jsonl)?\s*/i, '')
    .replace(/\s*```$/, '')
  let input: unknown
  try {
    input = JSON.parse(clean)
  } catch {
    try {
      input = clean
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
    } catch {
      throw new Error('JSON 格式无效，请检查引号、逗号和括号')
    }
  }
  if (Array.isArray(input))
    input = {
      schemaVersion: 'lingui.document/1',
      title: '导入的组件',
      parameters: [],
      messages: input,
    }
  if (input && typeof input === 'object' && !('schemaVersion' in input) && 'messages' in input) {
    const wrapper = input as { messages: unknown[]; name?: string }
    input = {
      schemaVersion: 'lingui.document/1',
      title: wrapper.name ?? '导入的组件',
      parameters: [],
      messages: wrapper.messages,
    }
  }
  return validateDocument(input)
}
