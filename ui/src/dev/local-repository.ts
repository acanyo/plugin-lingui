import { validateSources } from '../remix/provenance'
import {
  importDocument,
  validateDocument,
  validateTheme,
  type LinguiDocument,
  type ThemeTokens,
} from '@lingui/renderer'
import type { StudioRepository, TemplateRecord } from '../component-library/types'
import { localOperation as operation } from './database'
import { createLocalFontRepository } from './font-repository'
export function createLocalRepository(): StudioRepository {
  return {
    mode: 'local',
    ...createLocalFontRepository(),
    async listTemplates() {
      const records = await operation<TemplateRecord[]>('templates', 'readonly', (store) =>
        store.getAll(),
      )
      for (const record of records)
        for (const revision of record.revisions) {
          if (revision.provenance) revision.provenance = validateSources(revision.provenance)
          revision.document = validateDocument(revision.document)
          if (revision.theme) revision.theme = validateTheme(revision.theme)
        }
      return records
    },
    async saveTemplate(record) {
      const safe = JSON.parse(JSON.stringify(record)) as TemplateRecord
      safe.revisions.forEach((revision) => {
        if (revision.provenance) revision.provenance = validateSources(revision.provenance)
        revision.document = validateDocument(revision.document)
        if (revision.theme) revision.theme = validateTheme(revision.theme)
      })
      const current = await operation<TemplateRecord | undefined>(
        'templates',
        'readonly',
        (store) => store.get(safe.id),
      )
      if (current && current.versionToken !== safe.versionToken)
        throw new Error('组件已被其他窗口修改，请刷新组件库后重试')
      safe.versionToken = (current?.versionToken ?? 0) + 1
      await operation('templates', 'readwrite', (store) => store.put(safe))
      return safe
    },
    async deleteTemplate(id) {
      await operation('templates', 'readwrite', (store) => store.delete(id))
    },
    listThemes: () => operation('themes', 'readonly', (store) => store.getAll()),
    async saveTheme(theme: ThemeTokens) {
      const safe = validateTheme(theme)
      await operation('themes', 'readwrite', (store) => store.put(safe))
      return safe
    },
    async deleteTheme(id) {
      await operation('themes', 'readwrite', (store) => store.delete(id))
    },
    async generate(_instruction: string, _document?: LinguiDocument) {
      throw new Error(
        '本机工作室不保存 AI 密钥。请在 Halo 中配置 AI，或连接 Halo MCP 与 Skill，使用外部 AI 创作后导入 JSON。',
      )
    },
    async generateTheme() {
      throw new Error(
        '请在 Halo 中使用 AI 生成主题，或连接 Halo MCP 与 Skill，使用外部 AI 创作后导入主题 JSON。',
      )
    },
  }
}
export { importDocument }
