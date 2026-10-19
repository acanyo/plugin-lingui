import { validateSources } from '../remix/provenance'
import { GenerationOutputError } from '../ai-adapter/output-error'
import { axiosInstance } from '@halo-dev/api-client'
import {
  validateDocument,
  validateTheme,
  type LinguiDocument,
  type ThemeTokens,
} from '@lingui/renderer'
import {
  ComponentTemplateV1alpha1Api,
  DesignThemeV1alpha1Api,
  LinguiAiApi,
  type ComponentTemplate,
  type DesignTheme,
} from '../api/generated'
import type { Revision, StudioRepository, TemplateRecord } from '../component-library/types'
import { parseGeneratedDesign } from '../ai-adapter/design-result'
import { parseGeneratedTheme } from '../theme-studio/ai/theme-result'
import { createHaloFontRepository } from './halo-font-repository'
import type { GenerationOptions } from '../ai-adapter/progress/types'
import { decodeStreamFailure, readGenerationStream } from '../ai-adapter/progress/event-stream'
const templates = new ComponentTemplateV1alpha1Api(undefined, '', axiosInstance)
const themes = new DesignThemeV1alpha1Api(undefined, '', axiosInstance)
const ai = new LinguiAiApi(undefined, '', axiosInstance)
function decode(resource: ComponentTemplate): TemplateRecord {
  const revisions = JSON.parse(resource.spec.history) as Revision[]
  if (!Array.isArray(revisions) || !revisions.length || revisions.length > 20)
    throw new Error(`组件 ${resource.spec.displayName} 的版本记录无效`)
  const seen = new Set<number>()
  for (const revision of revisions) {
    if (
      !Number.isInteger(revision.version) ||
      revision.version < 1 ||
      seen.has(revision.version) ||
      typeof revision.createdAt !== 'string'
    )
      throw new Error('组件版本记录无效')
    seen.add(revision.version)
    if (revision.provenance) revision.provenance = validateSources(revision.provenance)
    revision.document = validateDocument(revision.document)
    if (revision.theme) revision.theme = validateTheme(revision.theme)
  }
  return {
    id: resource.metadata.name,
    name: resource.spec.displayName,
    category: resource.spec.category,
    description: resource.spec.description ?? '',
    revisions,
    versionToken: resource.metadata.version ?? undefined,
  }
}
export function createHaloRepository(): StudioRepository {
  const themeResources = new Map<string, DesignTheme>()
  return {
    mode: 'halo',
    async getGenerationSettings() {
      const { data } = await ai.getLinguiGenerationSettings()
      return data
    },
    ...createHaloFontRepository(),
    async listTemplates() {
      const result: TemplateRecord[] = []
      for (let page = 1; ; page++) {
        const { data } = await templates.listComponentTemplate({ page, size: 100 })
        result.push(...data.items.filter((item) => !item.metadata.deletionTimestamp).map(decode))
        if (page * 100 >= data.total) break
      }
      return result
    },
    async saveTemplate(record) {
      record.revisions.forEach((revision) => {
        revision.document = validateDocument(revision.document)
        if (revision.theme) revision.theme = validateTheme(revision.theme)
      })
      const history = JSON.stringify(record.revisions)
      if (history.length > 2097152)
        throw new Error('版本记录超过 2 MiB，请导出旧版本后减少保留数量')
      const resource: ComponentTemplate = {
        apiVersion: 'lingui.acanyo.com/v1alpha1',
        kind: 'ComponentTemplate',
        metadata: {
          name: record.id,
          ...(record.versionToken !== undefined ? { version: record.versionToken } : {}),
        },
        spec: {
          displayName: record.name,
          category: record.category,
          description: record.description,
          revision: record.revisions.at(-1)!.version,
          history,
        },
      }
      const { data } =
        record.versionToken !== undefined
          ? await templates.updateComponentTemplate({
              name: record.id,
              componentTemplate: resource,
            })
          : await templates.createComponentTemplate({ componentTemplate: resource })
      return decode(data)
    },
    async deleteTemplate(id) {
      await templates.deleteComponentTemplate({ name: id })
    },
    async listThemes() {
      const result: ThemeTokens[] = []
      for (let page = 1; ; page++) {
        const { data } = await themes.listDesignTheme({ page, size: 100 })
        for (const resource of data.items.filter((item) => !item.metadata.deletionTimestamp)) {
          themeResources.set(resource.metadata.name, resource)
          result.push(validateTheme(JSON.parse(resource.spec.tokens)))
        }
        if (page * 100 >= data.total) break
      }
      return result
    },
    async saveTheme(theme: ThemeTokens) {
      const safe = validateTheme(theme),
        existing = themeResources.get(safe.id)
      const resource: DesignTheme = {
        apiVersion: 'lingui.acanyo.com/v1alpha1',
        kind: 'DesignTheme',
        metadata: existing?.metadata ?? { name: safe.id },
        spec: { displayName: safe.name, tokens: JSON.stringify(safe) },
      }
      const { data } = existing
        ? await themes.updateDesignTheme({ name: safe.id, designTheme: resource })
        : await themes.createDesignTheme({ designTheme: resource })
      themeResources.set(safe.id, data)
      return validateTheme(JSON.parse(data.spec.tokens))
    },
    async deleteTheme(id) {
      await themes.deleteDesignTheme({ name: id })
      themeResources.delete(id)
    },
    async generate(instruction: string, document?: LinguiDocument, options?: GenerationOptions) {
      const request = {
        generateRequest: {
          instruction,
          ...(options?.modelName !== undefined ? { modelName: options.modelName } : {}),
          ...(document ? { document: JSON.stringify(validateDocument(document)) } : {}),
        },
      }
      let content: string
      if (options?.onProgress) {
        try {
          const response = await ai.generateLinguiComponent(request, {
            adapter: 'fetch',
            responseType: 'stream',
            signal: options.signal,
            timeout: 375000,
            headers: { Accept: 'text/event-stream' },
          })
          if (!String(response.headers['content-type']).includes('text/event-stream'))
            throw new Error('当前服务未返回实时进度，请确认 Halo 中的灵构 UI 已更新后重试。')
          content = await readGenerationStream(
            response.data as unknown as ReadableStream<Uint8Array>,
            options.onProgress,
            options.signal,
          )
        } catch (cause) {
          throw await decodeStreamFailure(cause)
        }
      } else {
        const { data } = await ai.generateLinguiComponent(request, {
          signal: options?.signal,
          timeout: 375000,
        })
        content = data.content ?? ''
      }
      try {
        return parseGeneratedDesign(content)
      } catch (cause) {
        throw new GenerationOutputError(cause)
      }
    },
    async generateTheme(instruction, theme, options) {
      const { customFont, ...base } = theme ? validateTheme(theme) : { customFont: undefined }
      const { data } = await ai.generateLinguiTheme(
        {
          generateThemeRequest: {
            instruction,
            ...(options?.modelName !== undefined ? { modelName: options.modelName } : {}),
            ...(theme ? { theme: JSON.stringify(base) } : {}),
          },
        },
        { signal: options?.signal, timeout: 375000 },
      )
      const result = parseGeneratedTheme(data.content ?? '')
      delete result.customFont
      if (customFont) result.customFont = customFont
      return result
    },
  }
}
