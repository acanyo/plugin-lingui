import { validateSources, licenseProblem, type WorkSource } from '../remix/provenance'
import { validateSharedDemos, type SharedDemo } from '../interaction-recordings/shared-demo'
import { validateInstance, type ComponentInstance } from '@lingui/renderer'

export const submissionSchema = 'lingui.marketplace/1' as const
export const licenses = ['MIT', 'Apache-2.0', 'GPL-3.0', '保留所有权利']
export interface SubmissionDraft {
  schemaVersion: typeof submissionSchema
  kind?: 'component' | 'theme'
  id: string
  title: string
  description: string
  category: string
  author: string
  version: string
  license: string
  notes: string
  updatedAt: string
  revision: number
  provenance?: WorkSource[]
  demos?: SharedDemo[]
  instance: ComponentInstance
}
/** Local drafts may be incomplete. Exported works require complete listing metadata. */
export function validateSubmission(value: unknown, complete = false): SubmissionDraft {
  if (!value || typeof value !== 'object') throw new Error('作品包格式无效')
  const source = value as Record<string, unknown>
  if (source.schemaVersion !== submissionSchema) throw new Error('不支持此作品包版本')
  const result: Record<string, unknown> = { schemaVersion: submissionSchema }
  if (source.kind !== undefined) {
    if (source.kind !== 'component' && source.kind !== 'theme') throw new Error('不支持此投稿类型')
    result.kind = source.kind
  }
  for (const [key, max] of Object.entries({
    id: 100,
    title: 120,
    description: 500,
    category: 80,
    author: 80,
    version: 30,
    license: 40,
    notes: 2000,
    updatedAt: 40,
  })) {
    if (typeof source[key] !== 'string' || source[key].length > max)
      throw new Error(`作品字段 ${key} 无效或过长`)
    result[key] = source[key].trim()
  }
  if (!/^submission-[\w-]+$/.test(result.id as string)) throw new Error('草稿标识无效')
  if (!Number.isSafeInteger(source.revision) || Number(source.revision) < 0)
    throw new Error('草稿修订号无效')
  if (Number.isNaN(Date.parse(result.updatedAt as string))) throw new Error('草稿时间无效')
  if (result.license && !licenses.includes(result.license as string))
    throw new Error('请选择支持的许可证')
  if (result.version && !/^\d+\.\d+\.\d+$/.test(result.version as string))
    throw new Error('作品版本请使用 1.0.0 这样的格式')
  if (complete) {
    for (const [key, label] of Object.entries({
      title: '作品名称',
      description: '作品简介',
      category: '分类',
      author: '作者名称',
      version: '作品版本',
      license: '许可证',
    })) {
      if (!result[key]) throw new Error(`导出前请填写${label}`)
    }
  }
  if (source.provenance !== undefined) result.provenance = validateSources(source.provenance)
  const instance = validateInstance(source.instance)
  if (source.demos !== undefined) result.demos = validateSharedDemos(source.demos, instance)
  if (complete && result.provenance) {
    const problem = licenseProblem(result.provenance as WorkSource[], result.license as string)
    if (problem) throw new Error(problem)
  }
  return {
    ...result,
    revision: Number(source.revision),
    instance,
  } as unknown as SubmissionDraft
}
export function createSubmission(
  instance: ComponentInstance,
  provenance?: WorkSource[],
): SubmissionDraft {
  return validateSubmission({
    schemaVersion: submissionSchema,
    id: `submission-${crypto.randomUUID()}`,
    title: instance.document.title,
    description: '',
    category: '未分类',
    author: '',
    version: '1.0.0',
    license: '',
    notes: '',
    updatedAt: new Date().toISOString(),
    revision: 0,
    instance,
    ...(provenance?.length ? { provenance } : {}),
  })
}
export function exportSubmission(draft: SubmissionDraft) {
  const safe = validateSubmission(draft, true)
  // Local identity and revision are not part of the portable publication contract.
  const { id: _id, revision: _revision, updatedAt: _updatedAt, ...work } = safe
  delete work.instance.templateId
  delete work.instance.templateVersion
  return work
}
export function submissionKind(draft: Pick<SubmissionDraft, 'kind'>) {
  return draft.kind === 'theme' ? 'theme' : 'component'
}
export function importSubmission(text: string): SubmissionDraft {
  if (new TextEncoder().encode(text).byteLength > 524288) throw new Error('作品包不能超过 512 KiB')
  const source = JSON.parse(text)
  return validateSubmission(
    {
      ...source,
      id: `submission-${crypto.randomUUID()}`,
      revision: 0,
      updatedAt: new Date().toISOString(),
    },
    true,
  )
}
