/** A portable snapshot of a managed family; font binaries stay on their public host. */
export interface FontFaceSource {
  url: string
  format: 'woff2' | 'woff'
  weight: string
  style: 'normal' | 'italic'
  unicodeRange?: string
}
export interface FontFamilyDefinition {
  id: string
  name: string
  faces: FontFaceSource[]
}
