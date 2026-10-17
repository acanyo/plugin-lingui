import { createInstance, validateInstance, type ComponentInstance } from '@lingui/renderer'
import type { GeneratedDesign } from '../ai-adapter/design-result'
import type { InteractionCheck } from '../interaction-check/types'
import { validInteractionCheck } from '../interaction-check/validation'
import { validTrace, type GenerationTrace } from '../ai-adapter/progress/types'
import { updateInstanceDocument } from '../component-studio/document-editor'
import { cloneJson } from '../shared/clone'
export interface DesignCandidate {
  id: string
  direction: string
  status: 'queued' | 'running' | 'done' | 'error' | 'stopped'
  instance?: ComponentInstance
  error?: string
  check?: InteractionCheck
  trace?: GenerationTrace
}
export interface CandidateSet {
  id: string
  prompt: string
  source?: ComponentInstance
  candidates: DesignCandidate[]
}
export function candidateInstance(design: GeneratedDesign, source?: ComponentInstance) {
  const next = source
    ? updateInstanceDocument(source, design.document)
    : createInstance(design.document)
  // An explicit existing theme stays authoritative across layout candidates.
  if (!source && design.theme) next.theme = cloneJson(design.theme)
  return validateInstance(next)
}
export function combineCandidateTheme(
  layout: ComponentInstance,
  colors: ComponentInstance,
): ComponentInstance {
  const theme = {
    ...cloneJson(layout.theme),
    mode: colors.theme.mode,
    colors: cloneJson(colors.theme.colors),
  }
  return validateInstance({
    ...cloneJson(layout),
    theme: { ...theme, id: `theme-${crypto.randomUUID()}`, name: '组合配色' },
  })
}
export function validateCandidateSet(value: CandidateSet): CandidateSet {
  if (
    !value ||
    typeof value.id !== 'string' ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > 3400 ||
    !Array.isArray(value.candidates) ||
    value.candidates.length > 4
  )
    throw new Error('方案历史无效')
  if (value.source) value.source = validateInstance(value.source)
  const ids = new Set<string>()
  for (const item of value.candidates) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      ids.has(item.id) ||
      typeof item.direction !== 'string' ||
      item.direction.length > 160 ||
      !['queued', 'running', 'done', 'error', 'stopped'].includes(item.status)
    )
      throw new Error('候选方案无效')
    ids.add(item.id)
    if (item.instance) item.instance = validateInstance(item.instance)
    if (item.status === 'done' && !item.instance) throw new Error('方案缺少设计')
    if (item.trace && !validTrace(item.trace)) throw new Error('方案执行过程无效')
    if (item.check && !validInteractionCheck(item.check)) throw new Error('方案检查记录无效')
    if (['running', 'queued'].includes(item.status)) {
      item.status = 'stopped'
      item.error = '上次生成已中断，可单独重试'
    }
  }
  return cloneJson(value)
}
