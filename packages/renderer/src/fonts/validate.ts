import { assertSafeJson } from '../protocol/validate'
import { safeMediaUrl } from '../protocol/media-url'
import type { FontFamilyDefinition } from './types'
export const MAX_FONT_BYTES = 196608
export const MAX_FONT_FACES = 512
export function fontUrl(value: unknown): string | undefined {
  const safe = safeMediaUrl(value)
  if (!safe || !/^https?:\/\//.test(safe) || safe.includes('#')) return
  return safe
}
export function validFontWeight(value: string): boolean {
  const match = /^(\d{1,4})(?:\s+(\d{1,4}))?$/.exec(value)
  if (!match) return false
  const from = Number(match[1]),
    to = Number(match[2] ?? match[1])
  return from >= 1 && to <= 1000 && from <= to
}
export function validUnicodeRange(value: string): boolean {
  if (!value || value.length > 2048) return false
  const ranges = value.split(',').map((part) => part.trim())
  if (ranges.length > 128) return false
  return ranges.every((part) => {
    const range = /^U\+([0-9A-F]{1,6})(?:-([0-9A-F]{1,6}))?$/i.exec(part)
    if (range) {
      const start = parseInt(range[1]!, 16),
        end = parseInt(range[2] ?? range[1]!, 16)
      return start <= end && end <= 0x10ffff
    }
    const wildcard = /^U\+([0-9A-F]*\?+)$/i.exec(part)
    return Boolean(
      wildcard &&
      wildcard[1]!.length <= 6 &&
      parseInt(wildcard[1]!.replace(/\?/g, 'F'), 16) <= 0x10ffff,
    )
  })
}
export function validateFontFamily(input: unknown): FontFamilyDefinition {
  assertSafeJson(input)
  const font = input as FontFamilyDefinition
  if (
    !font ||
    typeof font !== 'object' ||
    Array.isArray(font) ||
    Object.keys(font).some((key) => !['id', 'name', 'faces'].includes(key))
  )
    throw new Error('字体配置格式无效')
  if (
    typeof font.id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(font.id) ||
    typeof font.name !== 'string' ||
    !font.name.trim() ||
    font.name.length > 120
  )
    throw new Error('字体名称或标识无效')
  if (!Array.isArray(font.faces) || !font.faces.length || font.faces.length > MAX_FONT_FACES)
    throw new Error(`字体需要 1–${MAX_FONT_FACES} 个分包`)
  for (const face of font.faces) {
    if (
      !face ||
      Object.keys(face).some(
        (key) => !['url', 'format', 'weight', 'style', 'unicodeRange'].includes(key),
      )
    )
      throw new Error('字体分包包含未知配置')
    if (!fontUrl(face.url) || !['woff2', 'woff'].includes(face.format))
      throw new Error(
        '字体分包必须使用公开 HTTPS 地址和 WOFF2 / WOFF 格式；本地开发地址可使用 HTTP',
      )
    if (
      typeof face.weight !== 'string' ||
      !validFontWeight(face.weight) ||
      !['normal', 'italic'].includes(face.style)
    )
      throw new Error('字体字重或样式无效')
    if (
      face.unicodeRange !== undefined &&
      (typeof face.unicodeRange !== 'string' || !validUnicodeRange(face.unicodeRange))
    )
      throw new Error('字体分包的字符范围无效')
  }
  if (new TextEncoder().encode(JSON.stringify(font)).length > MAX_FONT_BYTES)
    throw new Error('字体配置不能超过 192 KiB')
  return JSON.parse(JSON.stringify(font))
}
