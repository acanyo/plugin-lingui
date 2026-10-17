import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { createInstance } from '@lingui/renderer'
import { useWorkRevisions } from '../revisions/useWorkRevisions'
import { revisionDiff } from '../revisions/diff'
import { validateSnapshot } from '../creation-history/types'
import { createBlankDocument } from '../component-studio/document-editor'
describe('reversible work revisions', () => {
  it('undoes to empty, redoes and truncates only the redo branch after new edits', () => {
    const current = shallowRef<ReturnType<typeof createInstance>>()
    const revisions = useWorkRevisions(
      () => current.value,
      (value) => {
        current.value = value
      },
    )
    const first = createInstance(createBlankDocument())
    revisions.commit(first, 'AI 生成')
    revisions.undo()
    expect(current.value).toBeUndefined()
    expect(revisions.canRedo.value).toBe(true)
    revisions.redo()
    expect(current.value).toEqual(first)
    revisions.commit({ ...first, document: { ...first.document, title: '第二版' } }, '手动修改')
    const secondId = revisions.history.value!.entries.at(-1)!.id
    revisions.undo()
    revisions.commit({ ...first, document: { ...first.document, title: '新分支' } }, '手动修改')
    expect(revisions.canRedo.value).toBe(false)
    expect(revisions.history.value!.entries.some((item) => item.id === secondId)).toBe(false)
    expect(revisions.history.value!.archived?.some((item) => item.id === secondId)).toBe(true)
    const firstId = revisions.history.value!.entries[1]!.id
    revisions.restore(firstId)
    expect(current.value!.document.title).toBe(first.document.title)
    revisions.undo()
    expect(current.value!.document.title).toBe('新分支')
    revisions.restore(secondId)
    expect(current.value!.document.title).toBe('第二版')
  })
  it('bounds history and persists it inside existing creation snapshots without changing conversation', () => {
    const current = shallowRef(createInstance(createBlankDocument()))
    const revisions = useWorkRevisions(
      () => current.value,
      (value) => {
        current.value = value!
      },
    )
    for (let index = 0; index < 40; index++)
      revisions.commit(
        { ...current.value, document: { ...current.value.document, title: `作品 ${index}` } },
        '手动修改',
      )
    expect(revisions.history.value!.entries).toHaveLength(30)
    const snapshot = validateSnapshot({
      instance: current.value,
      dirty: true,
      editing: false,
      instruction: '',
      messages: [{ id: 1, role: 'user', status: 'done', text: '需求' }],
      workRevisions: revisions.history.value,
    })
    const restored = useWorkRevisions(
      () => current.value,
      (value) => {
        current.value = value!
      },
    )
    restored.reset(snapshot.workRevisions)
    restored.undo()
    expect(current.value.document.title).toBe('作品 38')
    expect(snapshot.messages[0]!.text).toBe('需求')
    expect(revisionDiff(snapshot.instance, current.value)).toContain('名称：作品 39 → 作品 38')
  })
})
