import { validateArticleSource, type ArticleSource } from '../article-transform/source'
import { validateSources, type WorkSource } from '../remix/provenance'
import { validateCandidateSet, type CandidateSet } from '../design-candidates/model'
import { validateRecording, type InteractionRecording } from '../interaction-recordings/model'
import { validateRevisionHistory, type RevisionHistory } from '../revisions/types'
import { validateInstance, type ComponentInstance } from '@lingui/renderer'
import { validateGeneratedDesign, type GeneratedDesign } from '../ai-adapter/design-result'
import type { ConversationMessage } from '../ai-adapter/conversation'
import { cloneJson } from '../shared/clone'
import { finishTrace, validTrace } from '../ai-adapter/progress/types'
import { validInteractionCheck } from '../interaction-check/validation'
import { validateEditProposal, validateEditTarget } from '../scoped-edit/model'

export type CreationOrigin = 'ai' | 'blank' | 'project' | 'import' | 'market' | 'article'
export const originLabels: Record<CreationOrigin, string> = {
  ai: 'AI 创作',
  blank: '手动创作',
  project: '项目编辑',
  import: '导入作品',
  market: '市场作品',
  article: '文章组件',
}
export interface CreationSnapshot {
  articleSource?: ArticleSource
  provenance?: WorkSource[]
  candidates?: CandidateSet
  recordings?: InteractionRecording[]
  instance?: ComponentInstance
  messages: ConversationMessage[]
  instruction: string
  dirty: boolean
  editing: boolean
  project?: { id: string; versionToken?: number }
  pendingAi?: GeneratedDesign
  workRevisions?: RevisionHistory
}
export interface CreationRecord extends CreationSnapshot {
  id: string
  scope: string
  origin: CreationOrigin
  revision: number
  createdAt: string
  updatedAt: string
}
export function creationTitle(record: CreationSnapshot): string {
  return (
    record.instance?.document.title ||
    record.messages.find((message) => message.role === 'user')?.text.slice(0, 80) ||
    record.instruction.slice(0, 80) ||
    '未命名创作'
  )
}
export function hasCreation(snapshot: CreationSnapshot): boolean {
  return !!(snapshot.instance || snapshot.messages.length || snapshot.instruction.trim())
}
export function validateSnapshot(snapshot: CreationSnapshot): CreationSnapshot {
  const safe = cloneJson(snapshot)
  if (
    !Array.isArray(safe.messages) ||
    typeof safe.instruction !== 'string' ||
    safe.instruction.length > 4000
  )
    throw new Error('创作历史中的对话数据无效')
  const ids = new Set<number>()
  for (const message of safe.messages) {
    if (
      !Number.isSafeInteger(message.id) ||
      message.id < 1 ||
      ids.has(message.id) ||
      !['user', 'assistant'].includes(message.role) ||
      !['pending', 'done', 'error'].includes(message.status) ||
      typeof message.text !== 'string'
    )
      throw new Error('创作历史中的消息无效')
    ids.add(message.id)
    if (message.editTarget) message.editTarget = validateEditTarget(message.editTarget)
    if (message.editProposal) message.editProposal = validateEditProposal(message.editProposal)
    if (message.draft) message.draft = validateGeneratedDesign(message.draft)
    if (message.check && !validInteractionCheck(message.check))
      throw new Error('创作历史中的检查记录无效')
    if (message.progress && !validTrace(message.progress))
      throw new Error('创作历史中的执行记录无效')
  }
  if (safe.articleSource) safe.articleSource = validateArticleSource(safe.articleSource)
  if (safe.provenance) safe.provenance = validateSources(safe.provenance)
  if (safe.candidates) safe.candidates = validateCandidateSet(safe.candidates)
  if (safe.recordings) {
    if (!Array.isArray(safe.recordings) || safe.recordings.length > 12)
      throw new Error('录制历史无效')
    safe.recordings = safe.recordings.map(validateRecording)
  }
  if (safe.instance) safe.instance = validateInstance(safe.instance)
  if (safe.workRevisions) safe.workRevisions = validateRevisionHistory(safe.workRevisions)
  if (safe.pendingAi) safe.pendingAi = validateGeneratedDesign(safe.pendingAi)
  if (JSON.stringify(safe).length > 4194304)
    throw new Error('这段创作历史超过 4 MiB，请保存项目后新建对话')
  return {
    ...(safe.articleSource ? { articleSource: safe.articleSource } : {}),
    ...(safe.provenance ? { provenance: safe.provenance } : {}),
    ...(safe.candidates ? { candidates: safe.candidates } : {}),
    ...(safe.recordings ? { recordings: safe.recordings } : {}),
    messages: safe.messages,
    instruction: safe.instruction,
    dirty: safe.dirty,
    editing: safe.editing,
    ...(safe.instance ? { instance: safe.instance } : {}),
    ...(safe.workRevisions ? { workRevisions: safe.workRevisions } : {}),
    ...(safe.pendingAi ? { pendingAi: safe.pendingAi } : {}),
    ...(safe.project ? { project: safe.project } : {}),
  }
}
/** A request cannot be resumed after navigating away; retain its input and make retry explicit. */
export function resumeSnapshot(record: CreationSnapshot): CreationSnapshot {
  const snapshot = validateSnapshot(record)
  snapshot.messages = snapshot.messages.map((message) =>
    message.status !== 'pending'
      ? message
      : {
          ...message,
          status: 'error',
          ...(message.progress ? { progress: finishTrace(message.progress, 'stopped') } : {}),
          ...(message.role === 'assistant'
            ? {
                text: '上次生成在页面离开时中断。当前作品已保留，可以重试这条需求。',
                details:
                  '刷新或关闭页面后，工作台无法接收上次请求的结果。重试会使用当前作品继续生成。',
              }
            : {}),
        },
  )
  return snapshot
}
