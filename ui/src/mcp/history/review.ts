import {
  createInstance,
  pureTheme,
  validateTheme,
  type ComponentInstance,
  type ThemeTokens,
} from '@lingui/renderer'
import { parseGeneratedDesign } from '../../ai-adapter/design-result'
import { updateInstanceDocument } from '../../component-studio/document-editor'
import { templateInstance, type TemplateRecord } from '../../component-library/types'
import { revisionDiff } from '../../revisions/diff'
import type { DraftDetail, DraftInfo } from './client'
import { buildDraftMerge, designValue, type DraftMerge } from './changes'

export interface DraftReview {
  info: DraftInfo
  instance?: ComponentInstance
  theme?: ThemeTokens
  base?: ComponentInstance
  changes: string[]
  conflict: string
  merge?: DraftMerge
}
export function reviewDraft(
  detail: DraftDetail,
  projects: TemplateRecord[],
  current?: ComponentInstance,
): DraftReview {
  const info = detail.draft
  if (!info?.id || !detail.design) throw new Error('草稿数据不完整，请刷新后重试。')
  if (info.kind === 'theme') {
    const theme = validateTheme(JSON.parse(detail.design))
    return { info, theme, changes: ['主题草稿将载入主题编辑器，确认后再保存。'], conflict: '' }
  }
  if (info.kind !== 'component') throw new Error('不支持的草稿类型。')
  const design = parseGeneratedDesign(detail.design)
  const target = info.workName
    ? projects.find((project) => project.id === info.workName)
    : undefined
  const latest = target ? templateInstance(target, pureTheme) : undefined
  const activeTarget = target && current?.templateId === target.id ? current : undefined
  const openedRevision = target?.revisions.find(
    (item) => item.version === activeTarget?.templateVersion,
  )
  const opened =
    target && openedRevision
      ? templateInstance(
          { ...target, name: openedRevision.document.title, revisions: [openedRevision] },
          pureTheme,
        )
      : undefined
  const localStale =
    !!activeTarget &&
    activeTarget.templateVersion !== latest?.templateVersion &&
    (!opened ||
      designValue([activeTarget.document, activeTarget.theme, activeTarget.parameters]) !==
        designValue([opened.document, opened.theme, opened.parameters]))
  const base =
    activeTarget && (activeTarget.templateVersion === latest?.templateVersion || localStale)
      ? activeTarget
      : latest
  let instance = base
    ? updateInstanceDocument(base, design.document)
    : createInstance(design.document)
  if (design.theme) instance = { ...instance, theme: design.theme }
  const revision = target?.revisions.find((item) => item.version === info.baseRevision)
  const ancestor =
    target && revision
      ? templateInstance(
          { ...target, name: revision.document.title, revisions: [revision] },
          pureTheme,
        )
      : undefined
  const merge =
    ancestor && base && !localStale
      ? buildDraftMerge(ancestor, base, instance, !!design.theme)
      : undefined
  const conflict = localStale
    ? '当前工作台包含旧版本的未保存修改，项目在其他位置已有新版本。请先保存为新项目或重新打开最新项目，再进行合并；本次仍可作为新作品载入。'
    : info.workName
      ? !target
        ? '原项目已删除或无法访问，可将草稿作为新作品载入。'
        : target.revisions.at(-1)?.version !== info.baseRevision
          ? `草稿基于 v${info.baseRevision}，项目现为 v${target.revisions.at(-1)?.version}。${merge ? '可逐项合并修改；冲突项默认保留当前值。' : '基准版本不可用，请作为新作品载入。'}`
          : ''
      : ''
  return { info, instance, base, changes: revisionDiff(base, instance), conflict, merge }
}
