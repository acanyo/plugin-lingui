import type { FontFamilyDefinition } from './types'
import { validateFontFamily } from './validate'

export function fontFamilyName(font: FontFamilyDefinition): string {
  const text = JSON.stringify(font.faces)
  let a = 2166136261,
    b = 5381
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619)
    b = Math.imul(b, 33) ^ text.charCodeAt(i)
  }
  return `LinguiFont-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`
}
interface RegisteredFont {
  refs: number
  faces: FontFace[]
}
const documents = new WeakMap<Document, Map<string, RegisteredFont>>()

/** Register unloaded faces. The browser selects shards by unicode-range when text is used. */
export function registerFont(font: FontFamilyDefinition | undefined, doc: Document): () => void {
  if (!font || !doc.fonts || typeof FontFace === 'undefined') return () => undefined
  const safe = validateFontFamily(font),
    name = fontFamilyName(safe)
  let fonts = documents.get(doc)
  if (!fonts) {
    fonts = new Map()
    documents.set(doc, fonts)
  }
  let registration = fonts.get(name)
  if (!registration) {
    // Construct everything before adding anything, so malformed browser descriptors cannot leak faces.
    const faces = safe.faces.map(
      (source) =>
        new FontFace(name, `url(${JSON.stringify(source.url)}) format("${source.format}")`, {
          weight: source.weight,
          style: source.style,
          display: 'swap',
          ...(source.unicodeRange ? { unicodeRange: source.unicodeRange } : {}),
        }),
    )
    for (const face of faces) doc.fonts.add(face)
    registration = { refs: 0, faces }
    fonts.set(name, registration)
  }
  registration.refs++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--registration!.refs > 0) return
    for (const face of registration!.faces) doc.fonts.delete(face)
    fonts!.delete(name)
  }
}
