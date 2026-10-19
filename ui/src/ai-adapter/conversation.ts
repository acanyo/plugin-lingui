import type { GenerationTrace } from './progress/types'
import type { GeneratedDesign } from './design-result'
import type { InteractionCheck } from '../interaction-check/types'
import type { EditTarget, EditProposal } from '../scoped-edit/model'

export interface ConversationMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  status: 'pending' | 'done' | 'error'
  instruction?: string
  details?: string
  progress?: GenerationTrace
  draft?: GeneratedDesign
  check?: InteractionCheck
  editTarget?: EditTarget
  editProposal?: EditProposal
}
export type GenerationMode = 'single' | 'multiple'
export interface ConversationState {
  messages: ConversationMessage[]
  instruction: string
  generationMode?: GenerationMode
}

/** Keep completed requests in context without exceeding the existing API limit. */
export function conversationInstruction(
  messages: ConversationMessage[],
  instruction: string,
): string {
  const prefix = '此前的对话需求（以当前组件的实际内容为准）：\n'
  const suffix = `\n本次要求：\n${instruction}`
  let remaining = 4000 - prefix.length - suffix.length
  const context: string[] = []
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user' || message.status !== 'done') continue
    if (message.text.length + 1 > remaining) break
    context.unshift(message.text)
    remaining -= message.text.length + 1
    if (context.length === 6) break
  }
  return context.length ? `${prefix}${context.join('\n')}${suffix}` : instruction
}
