import { describe, expect, it } from 'vitest'
import { createInstance, parseSource, serializeSource, type ComponentNode } from '@lingui/renderer'
import { buildDraftMerge, applyDraftSelection, defaultDraftSelection } from '../mcp/history/changes'
import { reviewDraft } from '../mcp/history/review'
function instance(text = '原文', caption = '说明') {
  return createInstance({
    schemaVersion: 'lingui.document/2',
    title: '作品',
    parameters: [],
    state: { count: 1, note: '原始' },
    source: serializeSource([
      { id: 'root', component: 'Column', children: ['heading', 'caption'] },
      { id: 'heading', component: 'Text', text, variant: 'h2' },
      { id: 'caption', component: 'Text', text: caption, variant: 'caption' },
    ]),
  })
}
const node = (value: ReturnType<typeof instance>, id: string) =>
  parseSource(value.document.source).find((node) => node.id === id)!
describe('external draft three-way merge', () => {
  it('uses the latest project for a clean older tab and protects unsaved edits in a stale tab', () => {
    const original = instance(),
      latest = instance('服务器的新标题'),
      incoming = instance('原文', 'AI 的说明')
    const project = {
      id: 'work',
      name: '作品',
      category: '内容',
      description: '',
      revisions: [
        {
          version: 1,
          createdAt: '2026-10-15T00:00:00Z',
          document: original.document,
          theme: original.theme,
        },
        {
          version: 2,
          createdAt: '2026-10-15T01:00:00Z',
          document: latest.document,
          theme: latest.theme,
        },
      ],
    }
    const draft = {
      draft: { id: 'draft', kind: 'component', workName: 'work', baseRevision: 1 },
      design: JSON.stringify({ document: incoming.document }),
    }
    const active = { ...original, templateId: 'work', templateVersion: 1 }
    const review = reviewDraft(draft, [project], active)
    expect(review.merge).toBeDefined()
    expect(node(review.base!, 'heading').text).toBe('服务器的新标题')
    const dirty = { ...instance('本地尚未保存'), templateId: 'work', templateVersion: 1 }
    expect(reviewDraft(draft, [project], dirty).merge).toBeUndefined()
    expect(reviewDraft(draft, [project], dirty).conflict).toContain('旧版本的未保存修改')
  })
  it('applies independent AI edits while retaining user edits and only merges selected conflicts', () => {
    const ancestor = instance(),
      current = instance('用户的标题'),
      incoming = instance('AI 的标题', 'AI 的说明')
    current.document.state.count = 9
    incoming.document.state.note = 'AI 的备注'
    const merge = buildDraftMerge(ancestor, current, incoming, false)
    const selection = defaultDraftSelection(merge)
    expect(merge.changes.filter((change) => change.conflict)).toHaveLength(1)
    const result = applyDraftSelection(merge, selection)
    expect(node(result, 'heading').text).toBe('用户的标题')
    expect(node(result, 'caption').text).toBe('AI 的说明')
    expect(result.document.state).toEqual({ count: 9, note: 'AI 的备注' })
    const conflict = merge.changes.find((change) => change.conflict)!
    const resolved = applyDraftSelection(merge, {
      ...selection,
      keys: [...selection.keys, conflict.key],
    })
    expect(node(resolved, 'heading').text).toBe('AI 的标题')
    expect(node(current, 'heading').text).toBe('用户的标题')
  })
  it('rejects a stale review if the project changes before loading', () => {
    const ancestor = instance(),
      incoming = instance('AI')
    const first = buildDraftMerge(ancestor, ancestor, incoming, false)
    const changed = buildDraftMerge(ancestor, instance('并发修改'), incoming, false)
    expect(() => applyDraftSelection(changed, defaultDraftSelection(first))).toThrow(
      '审核期间发生了变化',
    )
  })
  it('rejects half-selected additions and removes disconnected nodes only with their references', () => {
    const before = instance(),
      after = instance()
    const nodes = parseSource(after.document.source)
    nodes[0]!.children!.push('new-node')
    nodes.push({ id: 'new-node', component: 'Text', text: '新增' })
    after.document.source = serializeSource(nodes)
    const merge = buildDraftMerge(before, before, after, false),
      all = defaultDraftSelection(merge)
    expect(parseSource(applyDraftSelection(merge, all).document.source)).toHaveLength(4)
    expect(() =>
      applyDraftSelection(merge, {
        ...all,
        keys: merge.changes
          .filter((change) => change.nodeId === 'root')
          .map((change) => change.key),
      }),
    ).toThrow('缺少关联组件')
    expect(() =>
      applyDraftSelection(merge, {
        ...all,
        keys: merge.changes
          .filter((change) => change.nodeId === 'new-node')
          .map((change) => change.key),
      }),
    ).toThrow('未连接')
    const removed = instance()
    removed.document.source = serializeSource([
      { id: 'root', component: 'Column', children: ['heading'] },
      node(removed, 'heading'),
    ] as ComponentNode[])
    const deletion = buildDraftMerge(before, before, removed, false)
    expect(
      parseSource(applyDraftSelection(deletion, defaultDraftSelection(deletion)).document.source),
    ).toHaveLength(2)
  })
  it('merges theme colors independently and keeps user parameters', () => {
    const before = instance(),
      current = instance(),
      incoming = instance()
    current.theme.colors.text = '#111111'
    incoming.theme.colors.accent = '#123456'
    const merge = buildDraftMerge(before, current, incoming, true)
    const result = applyDraftSelection(merge, defaultDraftSelection(merge))
    expect(result.theme.colors.text).toBe('#111111')
    expect(result.theme.colors.accent).toBe('#123456')
    expect(merge.changes.map((change) => change.label)).toContain('主题 · colors.accent')
  })
})
