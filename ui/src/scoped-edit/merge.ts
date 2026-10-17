import { childIds, type ComponentInstance } from '@lingui/renderer'
import { updateInstanceDocument } from '../component-studio/document-editor'
import {
  buildDraftMerge,
  designValue,
  applyDraftSelection,
  type DraftMerge,
  type DraftSelection,
} from '../revisions/design-changes'
import { assertEditScope, targetInfo, validateEditProposal, type EditProposal } from './model'

export function scopedMerge(proposal: EditProposal, current: ComponentInstance): DraftMerge {
  const safe = validateEditProposal(proposal)
  const before = targetInfo(safe.source.document, safe.target)
  const now = targetInfo(current.document, safe.target)
  if (designValue(before.path) !== designValue(now.path))
    throw new Error('目标组件的位置已改变，请重新选取并生成。')
  for (const id of before.ids) {
    const old = before.nodes.get(id)!,
      node = now.nodes.get(id)
    if (
      !node ||
      old.component !== node.component ||
      designValue(childIds(old)) !== designValue(childIds(node))
    )
      throw new Error(`组件 ${id} 的结构已改变，请重新生成局部修改。`)
  }
  const incoming = updateInstanceDocument(safe.source, safe.design.document)
  return buildDraftMerge(safe.source, current, incoming, false)
}
export function applyScopedSelection(
  proposal: EditProposal,
  merge: DraftMerge,
  selection: DraftSelection,
) {
  const result = applyDraftSelection(merge, selection)
  assertEditScope(merge.base, { document: result.document, theme: result.theme }, proposal.target)
  return result
}
