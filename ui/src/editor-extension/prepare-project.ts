import { pureTheme, validateInstance, type ComponentInstance } from '@lingui/renderer'
import {
  templateInstance,
  type StudioRepository,
  type TemplateRecord,
} from '../component-library/types'
import { cloneJson } from '../shared/clone'
import { validateSources, type WorkSource } from '../remix/provenance'

/** Explicit article creation saves its data before inserting a reference. Never discard draft parameters. */
export async function prepareArticleProject(
  value: ComponentInstance,
  repository: StudioRepository,
  canManage: boolean,
  signal: AbortSignal,
  provenance?: WorkSource[],
): Promise<ComponentInstance> {
  if (repository.mode !== 'halo') throw new Error('请在 Halo 中保存项目后插入文章')
  const instance = validateInstance(value)
  const projects = await repository.listTemplates()
  if (signal.aborted) throw new DOMException('操作已取消', 'AbortError')
  const previous = instance.templateId
    ? projects.find((item) => item.id === instance.templateId)
    : undefined
  if (instance.templateId && !previous) throw new Error('该项目已被删除，请重新选择项目')
  const document = cloneJson(instance.document)
  const sources = provenance ? validateSources(provenance) : previous?.revisions.at(-1)?.provenance
  for (const parameter of document.parameters)
    parameter.default = instance.parameters[parameter.key] ?? parameter.default
  if (previous) {
    const latest = templateInstance(previous, pureTheme)
    if (
      JSON.stringify(document) === JSON.stringify(latest.document) &&
      JSON.stringify(instance.theme) === JSON.stringify(latest.theme) &&
      JSON.stringify(sources ?? []) === JSON.stringify(previous.revisions.at(-1)?.provenance ?? [])
    )
      return latest
    if (instance.templateVersion !== latest.templateVersion)
      throw new Error('项目已更新，请在工作台核对最新版本后再插入')
  }
  if (!canManage) throw new Error('保存作品需要组件管理权限，请联系管理员授权')
  const record: TemplateRecord = {
    id: previous?.id ?? `component-${crypto.randomUUID()}`,
    name: document.title,
    category: previous?.category ?? '文章互动',
    description: previous?.description ?? '',
    ...(previous?.versionToken !== undefined ? { versionToken: previous.versionToken } : {}),
    revisions: [
      ...(previous?.revisions ?? []),
      {
        version: (previous?.revisions.at(-1)?.version ?? 0) + 1,
        createdAt: new Date().toISOString(),
        document,
        theme: cloneJson(instance.theme),
        ...(sources?.length ? { provenance: cloneJson(sources) } : {}),
      },
    ].slice(-20),
  }
  const saved = await repository.saveTemplate(record)
  return templateInstance(saved, pureTheme)
}
