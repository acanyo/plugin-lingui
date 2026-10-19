import type { WorkSource } from '../remix/provenance'
import { cloneJson } from '../shared/clone'
import type { ComponentInstance, LinguiDocument, ThemeTokens } from '@lingui/renderer'
import type { GeneratedDesign } from '../ai-adapter/design-result'
import type { ManagedFont } from '../font-library/types'
import type { GenerationOptions } from '../ai-adapter/progress/types'
import type { GenerationSettings } from '../api/generated'
export interface Revision {
  provenance?: WorkSource[]
  version: number
  createdAt: string
  document: LinguiDocument
  theme?: ThemeTokens
}
export interface TemplateRecord {
  id: string
  name: string
  category: string
  description: string
  revisions: Revision[]
  versionToken?: number
}
export interface StudioRepository {
  readonly mode: 'halo' | 'local'
  getGenerationSettings?(): Promise<GenerationSettings>
  listTemplates(): Promise<TemplateRecord[]>
  saveTemplate(record: TemplateRecord): Promise<TemplateRecord>
  deleteTemplate(id: string): Promise<void>
  listThemes(): Promise<ThemeTokens[]>
  saveTheme(theme: ThemeTokens): Promise<ThemeTokens>
  deleteTheme(id: string): Promise<void>
  listFonts(): Promise<ManagedFont[]>
  saveFont(font: ManagedFont): Promise<ManagedFont>
  deleteFont(id: string): Promise<void>
  generate(
    instruction: string,
    document?: LinguiDocument,
    options?: GenerationOptions,
  ): Promise<LinguiDocument | GeneratedDesign>
  generateTheme(
    instruction: string,
    theme?: ThemeTokens,
    options?: GenerationOptions,
  ): Promise<ThemeTokens>
}
export function templateInstance(template: TemplateRecord, theme: ThemeTokens): ComponentInstance {
  const revision = template.revisions.at(-1)!
  return {
    schemaVersion: 'lingui.instance/1',
    templateId: template.id,
    templateVersion: revision.version,
    document: { ...cloneJson(revision.document), title: template.name },
    parameters: Object.fromEntries(
      revision.document.parameters.map((parameter) => [parameter.key, parameter.default]),
    ),
    theme: cloneJson(revision.theme ?? theme),
  }
}
