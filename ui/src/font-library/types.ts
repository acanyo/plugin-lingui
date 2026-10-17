import type { FontFamilyDefinition } from '@lingui/renderer'
export interface ManagedFont {
  definition: FontFamilyDefinition
  sourceUrl?: string
  versionToken?: number
}
