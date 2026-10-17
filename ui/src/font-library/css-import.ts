import {
  fontUrl,
  validateFontFamily,
  type FontFaceSource,
  type FontFamilyDefinition,
} from '@lingui/renderer'

export const MAX_CSS_BYTES = 1048576
function unquote(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, '$2')
}
function resolveSource(value: string, baseUrl?: string): string {
  let resolved: string
  try {
    resolved = new URL(value, baseUrl).href
  } catch {
    throw new Error('CSS 中有相对字体路径，请填写这份 CSS 的原始地址。')
  }
  const safe = fontUrl(resolved)
  if (!safe) throw new Error('字体链接需为公开 HTTPS 地址；不支持 data、blob、凭据或本地文件地址。')
  return safe
}
function source(value: string, baseUrl?: string): Pick<FontFaceSource, 'url' | 'format'> {
  const matches = [
    ...value.matchAll(
      /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)(?:\s*format\(\s*['"]?([\w-]+)['"]?\s*\))?/gi,
    ),
  ]
  for (const match of matches) {
    const path = match[1] ?? match[2] ?? match[3]!
    const declared = match[4]?.toLowerCase().replace('-variations', '')
    const extension = /\.(woff2?)(?:[?#]|$)/i.exec(path)?.[1]?.toLowerCase()
    const format = declared ?? extension
    if (format !== 'woff2' && format !== 'woff') continue
    return { url: resolveSource(path, baseUrl), format }
  }
  throw new Error('每个字体分包需要 WOFF2 或 WOFF 的 url() 来源，不能只有 local() 字体。')
}

/** Parse in a detached stylesheet. Never attach imported CSS or follow its @import rules. */
export function importFontCss(text: string, baseUrl?: string): FontFamilyDefinition[] {
  if (!text.trim() || new TextEncoder().encode(text).length > MAX_CSS_BYTES)
    throw new Error('字体 CSS 不能为空或超过 1 MiB')
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
  if (/@import\b/i.test(clean))
    throw new Error('请导入实际包含 @font-face 的 CSS，暂不支持 @import 转引。')
  if (baseUrl && !fontUrl(baseUrl))
    throw new Error('CSS 原始地址需为公开 HTTPS 地址；本地开发地址可用 HTTP。')
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(text)
  const families = new Map<string, FontFaceSource[]>()
  for (const rule of sheet.cssRules) {
    if (rule.type !== CSSRule.FONT_FACE_RULE) continue
    const style = (rule as CSSFontFaceRule).style
    const family = unquote(style.getPropertyValue('font-family'))
    if (!family || /[,\\]/.test(family)) throw new Error('字体 CSS 的 font-family 需为单一字体名称')
    const rawWeight = style.getPropertyValue('font-weight').trim() || '400'
    const weight = rawWeight === 'normal' ? '400' : rawWeight === 'bold' ? '700' : rawWeight
    const face: FontFaceSource = {
      ...source(style.getPropertyValue('src'), baseUrl),
      weight,
      style: (style.getPropertyValue('font-style').trim() || 'normal') as FontFaceSource['style'],
      ...(style.getPropertyValue('unicode-range')
        ? { unicodeRange: style.getPropertyValue('unicode-range').trim() }
        : {}),
    }
    const faces = families.get(family) ?? []
    if (!faces.some((existing) => JSON.stringify(existing) === JSON.stringify(face)))
      faces.push(face)
    families.set(family, faces)
  }
  if (!families.size) throw new Error('没有识别到 @font-face，请确认上传的是字体 CSS')
  if (families.size > 20) throw new Error('一次最多导入 20 个字体家族，请拆分 CSS')
  return [...families].map(([name, faces]) =>
    validateFontFamily({ id: `font-${crypto.randomUUID()}`, name, faces }),
  )
}

export async function fetchFontCss(
  url: string,
  signal?: AbortSignal,
): Promise<{ text: string; sourceUrl: string }> {
  const safe = fontUrl(url.trim())
  if (!safe) throw new Error('请输入公开 HTTPS 字体 CSS 链接')
  const response = await fetch(safe, { credentials: 'omit', mode: 'cors', signal })
  if (!response.ok) throw new Error(`字体 CSS 下载失败：HTTP ${response.status}`)
  const finalUrl = fontUrl(response.url || safe)
  if (!finalUrl) throw new Error('字体 CSS 跳转到了不支持的地址')
  if (Number(response.headers.get('content-length')) > MAX_CSS_BYTES)
    throw new Error('字体 CSS 不能超过 1 MiB')
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (new TextEncoder().encode(text).length > MAX_CSS_BYTES)
      throw new Error('字体 CSS 不能超过 1 MiB')
    return { text, sourceUrl: finalUrl }
  }
  const decoder = new TextDecoder()
  let bytes = 0,
    text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_CSS_BYTES) throw new Error('字体 CSS 不能超过 1 MiB')
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  return { text, sourceUrl: finalUrl }
}
