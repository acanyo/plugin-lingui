import { describe, expect, it, vi } from 'vitest'
import {
  createInstance,
  parseSource,
  serializeSource,
  type ComponentInstance,
  type ComponentNode,
} from '@lingui/renderer'
import { contractDocument } from './fixtures/response-contract'
import { updateNode } from '../component-studio/document-editor'
import {
  assertEditScope,
  scopeViolations,
  scopedInstruction,
  targetInfo,
  type EditProposal,
} from '../scoped-edit/model'
import { scopedMerge, applyScopedSelection } from '../scoped-edit/merge'
import { defaultDraftSelection } from '../revisions/design-changes'
import { generateCheckedDesign, CheckedGenerationError } from '../ai-adapter/checked-generation'
import { resumeSnapshot, validateSnapshot } from '../creation-history/types'
import { cloneJson } from '../shared/clone'
import { newCheckFailures } from '../interaction-check/regressions'
import { runInteractionCheck } from '../interaction-check/run'

function edited(instance: ComponentInstance, id: string, patch: Partial<ComponentNode>) {
  const node = parseSource(instance.document.source).find((node) => node.id === id)!
  return { ...instance, document: updateNode(instance.document, { ...node, ...patch }) }
}
const node = (instance: ComponentInstance, id: string) =>
  parseSource(instance.document.source).find((node) => node.id === id)!
function proposal(): EditProposal {
  const source = createInstance(contractDocument())
  return {
    source,
    target: { nodeId: 'load', scope: 'subtree' },
    design: { document: edited(source, 'label', { text: '查询天气' }).document },
    state: 'pending',
  }
}
describe('scoped AI edit boundaries', () => {
  it('finds ancestors and distinguishes a node from its descendants', () => {
    const { source, design, target } = proposal()
    expect(targetInfo(source.document, { nodeId: 'label', scope: 'node' }).path).toEqual([
      'root',
      'load',
      'label',
    ])
    expect([...targetInfo(source.document, target).ids]).toEqual(['load', 'label'])
    expect(scopeViolations(source, design, target)).toEqual([])
    expect(scopeViolations(source, design, { ...target, scope: 'node' })).toContain(
      '范围外组件 label 的 text 被修改',
    )
    expect(() => targetInfo(source.document, { nodeId: 'missing', scope: 'node' })).toThrow('失效')
  })
  it.each([
    [
      'other component',
      (source: ComponentInstance) => ({
        document: edited(source, 'metric', { label: '其他内容' }).document,
      }),
    ],
    [
      'events',
      (source: ComponentInstance) => ({
        document: edited(source, 'load', { events: {} }).document,
      }),
    ],
    [
      'state',
      (source: ComponentInstance) => ({ document: { ...source.document, state: { response: 9 } } }),
    ],
    [
      'parameters',
      (source: ComponentInstance) => ({
        document: {
          ...source.document,
          parameters: [
            { key: 'city', label: '城市', type: 'string' as const, path: '/city', default: '北京' },
          ],
        },
      }),
    ],
    [
      'API',
      (source: ComponentInstance) => ({
        document: {
          ...source.document,
          integrations: { ...source.document.integrations!, apis: [] },
        },
      }),
    ],
    [
      'theme',
      (source: ComponentInstance) => ({
        document: source.document,
        theme: { ...source.theme, radius: 0 },
      }),
    ],
    [
      'structure',
      (source: ComponentInstance) => ({
        document: edited(source, 'load', { child: 'metric' }).document,
      }),
    ],
    [
      'component type',
      (source: ComponentInstance) => ({
        document: edited(source, 'label', { component: 'LingUI.Badge' }).document,
      }),
    ],
    [
      'added node',
      (source: ComponentInstance) => ({
        document: {
          ...source.document,
          source: serializeSource([
            ...parseSource(source.document.source),
            { id: 'new', component: 'Text', text: '额外' },
          ]),
        },
      }),
    ],
  ])('rejects changes to %s even within a root-wide selection', (_label, design) => {
    const { source, target } = proposal()
    const rootTarget =
      _label === 'other component' ? target : { nodeId: 'root', scope: 'subtree' as const }
    expect(scopeViolations(source, design(source), rootTarget).length).toBeGreaterThan(0)
  })
  it('prevents changing a binding into text or adding an expression to a static label', () => {
    const { source } = proposal()
    const bound = edited(source, 'label', { text: { path: '/city' } })
    expect(
      scopeViolations(
        bound,
        { document: edited(bound, 'label', { text: '静态城市' }).document },
        { nodeId: 'label', scope: 'node' },
      )[0],
    ).toContain('绑定')
    expect(
      scopeViolations(source, { document: bound.document }, { nodeId: 'label', scope: 'node' })[0],
    ).toContain('绑定')
  })
  it('retains scope rules and a bounded repair budget before configured API preservation can hide changes', async () => {
    const { source, target, design } = proposal()
    const outside = { ...design.document, integrations: { apis: [], callbacks: [] } }
    const generate = vi.fn().mockResolvedValue(design).mockResolvedValueOnce(outside)
    const result = await generateCheckedDesign({
      prompt: scopedInstruction('样式'.repeat(2000), source, target),
      source,
      context: source.document,
      compareChecksToSource: true,
      generate,
      signal: new AbortController().signal,
      progress: vi.fn(),
      attempt: vi.fn(),
      activity: vi.fn(),
      validateCandidate: (candidate) => assertEditScope(source, candidate, target),
    })
    expect(result.repairs).toBe(1)
    expect(generate.mock.calls[1]![0]).toContain('严格局部修改')
    expect(generate.mock.calls[1]![0]).toContain('不允许修改作品 integrations')
    expect(generate.mock.calls.every(([prompt]) => prompt.length <= 4000)).toBe(true)
    expect(generate.mock.calls[1]![1]).toEqual(source.document)
    generate.mockReset().mockResolvedValue(outside)
    const failed = (await generateCheckedDesign({
      prompt: scopedInstruction('改样式', source, target),
      source,
      context: source.document,
      generate,
      signal: new AbortController().signal,
      progress: vi.fn(),
      attempt: vi.fn(),
      activity: vi.fn(),
      validateCandidate: (candidate) => assertEditScope(source, candidate, target),
    }).catch((cause) => cause)) as CheckedGenerationError
    expect(generate).toHaveBeenCalledTimes(3)
    expect(failed.draft).toBeUndefined()
  })
})
describe('scoped edit review and history', () => {
  it('preserves unrelated manual edits and defaults conflicting attributes to the current value', () => {
    const draft = proposal()
    draft.design.document = edited({ ...draft.source, document: draft.design.document }, 'load', {
      variant: 'secondary',
    }).document
    let current = edited(cloneJson(draft.source), 'metric', { label: '手动标签' })
    current = edited(current, 'label', { text: '我的按钮文字' })
    current.document.state = { response: { temperature: 22 } }
    current.theme.radius = 12
    const merge = scopedMerge(draft, current),
      selection = defaultDraftSelection(merge)
    expect(merge.changes.filter((change) => change.conflict)).toHaveLength(1)
    const result = applyScopedSelection(draft, merge, selection)
    expect(node(result, 'label').text).toBe('我的按钮文字')
    expect(node(result, 'load').variant).toBe('secondary')
    expect(node(result, 'metric').label).toBe('手动标签')
    expect(result.theme).toEqual(current.theme)
    expect(result.document.state).toEqual(current.document.state)
    const all = applyScopedSelection(draft, merge, {
      ...selection,
      keys: merge.changes.map((change) => change.key),
    })
    expect(node(all, 'label').text).toBe('查询天气')
  })
  it('does not resurrect removed/replaced targets or overwrite a new manual binding', () => {
    const draft = proposal()
    expect(() =>
      scopedMerge(
        draft,
        edited(draft.source, 'load', {
          component: 'Column',
          child: undefined,
          children: ['label'],
        }),
      ),
    ).toThrow('结构已改变')
    const moved = edited(draft.source, 'root', { children: ['load', 'metric'] })
    moved.document.source = serializeSource(
      parseSource(moved.document.source).filter((node) => node.id !== 'list'),
    )
    // An unrelated deletion does not invalidate the target.
    expect(scopedMerge(draft, moved).changes).toHaveLength(1)
    const bound = edited(draft.source, 'label', { text: { path: '/city' } }),
      merge = scopedMerge(draft, bound)
    expect(() =>
      applyScopedSelection(draft, merge, {
        fingerprint: merge.fingerprint,
        keys: merge.changes.map((change) => change.key),
      }),
    ).toThrow('绑定')
    expect(() => scopedMerge(draft, edited(draft.source, 'load', { child: 'metric' }))).toThrow(
      '结构已改变',
    )
  })
  it('restores pending/adopted/discarded proposals and revalidates their source, target and scope', () => {
    const draft = proposal()
    const snapshot = {
      messages: [
        {
          id: 1,
          role: 'assistant' as const,
          text: '待确认',
          status: 'done' as const,
          editTarget: draft.target,
          editProposal: draft,
        },
      ],
      instruction: '',
      dirty: false,
      editing: false,
      instance: draft.source,
    }
    for (const state of ['pending', 'adopted', 'discarded'] as const) {
      snapshot.messages[0]!.editProposal.state = state
      expect(resumeSnapshot(snapshot).messages[0]!.editProposal?.state).toBe(state)
    }
    snapshot.messages[0]!.editProposal.design.document = edited(draft.source, 'metric', {
      label: '非法范围外修改',
    }).document
    expect(() => validateSnapshot(snapshot)).toThrow('超出授权范围')
  })
  it('distinguishes inherited interaction failures from new failures without hiding their reports', async () => {
    const source = createInstance(contractDocument()),
      baseline = await runInteractionCheck(source)
    expect(baseline.cases.some((row) => row.status === 'failed')).toBe(true)
    const same = await runInteractionCheck(edited(source, 'label', { text: '新文字' }))
    expect(newCheckFailures(same, baseline)).toEqual([])
    expect(same.cases.some((row) => row.status === 'failed')).toBe(true)
    const broken = edited(source, 'load', {
      events: { click: { actions: [{ type: 'api', name: 'missing' }] } },
    })
    expect(newCheckFailures(await runInteractionCheck(broken), baseline).length).toBeGreaterThan(0)
  })
})
