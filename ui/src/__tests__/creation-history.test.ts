import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, examples, pureTheme } from '@lingui/renderer'
import { useCreationHistory } from '../creation-history/useCreationHistory'
import {
  HistoryConflictError,
  type CreationHistoryRepository,
} from '../creation-history/repository'
import {
  creationTitle,
  resumeSnapshot,
  validateSnapshot,
  type CreationRecord,
  type CreationSnapshot,
} from '../creation-history/types'
import CreationHistoryDialog from '../creation-history/CreationHistoryDialog.vue'

let view: VueWrapper | undefined
const empty = (): CreationSnapshot => ({
  messages: [],
  instruction: '',
  dirty: false,
  editing: false,
})
afterEach(() => {
  view?.unmount()
  view = undefined
  vi.restoreAllMocks()
  sessionStorage.clear()
  document.body.replaceChildren()
})
function memoryRepository(initial: CreationRecord[] = []) {
  const records = new Map(
    initial.map((record) => [`${record.scope}/${record.id}`, structuredClone(record)]),
  )
  const repository: CreationHistoryRepository = {
    list: vi.fn(async (scope) =>
      [...records.values()]
        .filter((record) => record.scope === scope)
        .map((record) => structuredClone(record)),
    ),
    save: vi.fn(async (record) => {
      const key = `${record.scope}/${record.id}`
      if ((records.get(key)?.revision ?? 0) !== record.revision)
        throw new HistoryConflictError('other window')
      const saved = structuredClone({
        ...record,
        revision: record.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      records.set(key, saved)
      return saved
    }),
    remove: vi.fn(async (record) => {
      records.delete(`${record.scope}/${record.id}`)
    }),
  }
  return { repository, records }
}
async function setup(repository: CreationHistoryRepository, initial = empty(), autoResume = true) {
  const scope = ref<string | undefined>('halo:alice')
  const snapshot = shallowRef(initial)
  let history!: ReturnType<typeof useCreationHistory>
  view = mount(
    defineComponent({
      setup() {
        history = useCreationHistory(
          scope,
          () => snapshot.value,
          (value) => {
            snapshot.value = value
          },
          { autoResume, origin: 'ai', repository },
        )
        return () => h('div')
      },
    }),
  )
  await flushPromises()
  return { scope, snapshot, history }
}
function record(scope = 'halo:alice'): CreationRecord {
  const instance = createInstance(examples.find((example) => example.id === 'faq')!.create(), {
    ...pureTheme,
    id: 'custom',
    name: '我的主题',
    radius: 0,
  })
  return {
    ...empty(),
    id: 'saved-history',
    scope,
    origin: 'ai',
    revision: 1,
    createdAt: '2026-10-12T08:00:00Z',
    updatedAt: '2026-10-12T08:00:00Z',
    instance,
    dirty: true,
    editing: true,
    messages: [
      { id: 1, role: 'user', text: '制作一组常见问题', status: 'done' },
      { id: 2, role: 'assistant', text: '已生成', status: 'done' },
    ],
    instruction: '接下来调整字号',
  }
}
describe('persistent creation history', () => {
  it('restores failed drafts and diagnostics separately from the current project', async () => {
    const saved = record()
    const draft = {
      document: { ...saved.instance!.document, title: '待修复草稿' },
      theme: pureTheme,
    }
    saved.messages[1] = {
      ...saved.messages[1]!,
      status: 'error',
      draft,
      check: {
        schemaVersion: 'lingui.interaction-check/1',
        checkedAt: '2026-10-16T01:00:00Z',
        limited: false,
        cases: [
          {
            id: 'initial',
            nodeId: 'root',
            label: '初始计算',
            scenario: 'initial',
            status: 'failed',
            changedPaths: [],
            issues: [{ nodeId: 'value', level: 'error', message: '缺少字段' }],
          },
        ],
        issues: [{ nodeId: 'value', level: 'error', message: '缺少字段' }],
      },
    }
    const { repository } = memoryRepository([saved])
    sessionStorage.setItem('lingui-creation-current:halo:alice', saved.id)
    const { snapshot } = await setup(repository)
    expect(snapshot.value.instance).toEqual(saved.instance)
    expect(snapshot.value.messages[1]!.draft).toEqual(draft)
    expect(snapshot.value.messages[1]!.check).toEqual(saved.messages[1]!.check)
    const corrupted = structuredClone(saved)
    Object.assign(corrupted.messages[1]!.check!.cases[0]!, { issues: null })
    expect(() => validateSnapshot(corrupted)).toThrow('检查记录无效')
  })
  it('does not create history records for an untouched empty workspace', async () => {
    const { repository } = memoryRepository()
    const { history } = await setup(repository)
    await history.flush()
    expect(repository.save).not.toHaveBeenCalled()
    expect(history.entries.value).toHaveLength(0)
  })
  it('automatically retains unsent input and writes queued snapshots with increasing revisions', async () => {
    const { repository, records } = memoryRepository()
    const { snapshot, history } = await setup(repository)
    snapshot.value = { ...empty(), instruction: '第一段' }
    await flushPromises()
    snapshot.value = { ...empty(), instruction: '第二段' }
    await history.flush()
    await flushPromises()
    expect(records.size).toBe(1)
    expect(history.entries.value[0]!.instruction).toBe('第二段')
    expect(history.entries.value[0]!.revision).toBe(2)
  })
  it('persists removal of the last unsent input instead of restoring erased text', async () => {
    const { repository } = memoryRepository()
    const { snapshot, history } = await setup(repository, {
      ...empty(),
      instruction: '后来决定清空的输入',
    })
    snapshot.value = empty()
    await history.flush()
    await flushPromises()
    expect(history.entries.value[0]!.instruction).toBe('')
    view!.unmount()
    const restored = await setup(repository)
    expect(restored.snapshot.value.instruction).toBe('')
  })
  it('restores messages, input, editable instance, theme, parameters and pending conflict after remount', async () => {
    const saved = record()
    saved.pendingAi = { document: { ...saved.instance!.document, title: '尚未采用的生成结果' } }
    const { repository } = memoryRepository([saved])
    sessionStorage.setItem('lingui-creation-current:halo:alice', saved.id)
    const { snapshot, history } = await setup(repository)
    expect(snapshot.value).toMatchObject({
      instruction: saved.instruction,
      instance: saved.instance,
      editing: true,
      pendingAi: saved.pendingAi,
    })
    expect(snapshot.value.messages).toEqual(saved.messages)
    expect(history.activeId.value).toBe(saved.id)
    expect(repository.save).toHaveBeenCalledOnce()
  })
  it('keeps new conversations separate and allows older work to be resumed', async () => {
    const { repository } = memoryRepository()
    const { snapshot, history } = await setup(repository, { ...record(), project: undefined })
    const first = history.entries.value[0]!
    await history.flush()
    history.start('blank')
    snapshot.value = { ...empty(), instance: createInstance(examples[0]!.create()), dirty: true }
    await history.flush()
    await flushPromises()
    expect(history.entries.value).toHaveLength(2)
    await history.activate(first)
    expect(creationTitle(snapshot.value)).toBe(first.instance!.document.title)
    expect(snapshot.value.messages).toEqual(first.messages)
    expect(history.activeId.value).toBe(first.id)
  })
  it('does not replace an article instance with a previously selected standalone history', async () => {
    const saved = record()
    const { repository } = memoryRepository([saved])
    sessionStorage.setItem('lingui-creation-current:halo:alice', saved.id)
    const article = { ...empty(), instance: createInstance(examples[0]!.create()) }
    const { snapshot } = await setup(repository, article, false)
    expect(snapshot.value.instance).toEqual(article.instance)
    expect(snapshot.value.messages).toHaveLength(0)
  })
  it('clears the previous account workspace before loading another account history', async () => {
    const { repository, records } = memoryRepository([record('halo:bob')])
    const { snapshot, scope, history } = await setup(repository, {
      ...empty(),
      instruction: 'Alice 私密对话',
    })
    await history.flush()
    scope.value = 'halo:bob'
    await flushPromises()
    expect(snapshot.value).toEqual(empty())
    expect(history.entries.value.every((entry) => entry.scope === 'halo:bob')).toBe(true)
    expect([...records.values()].filter((entry) => entry.scope === 'halo:bob')).toHaveLength(1)
    expect([...records.values()].find((entry) => entry.scope === 'halo:alice')!.instruction).toBe(
      'Alice 私密对话',
    )
    await expect(
      history.activate([...records.values()].find((entry) => entry.scope === 'halo:alice')!),
    ).rejects.toThrow('其他账号')
  })
  it('preserves concurrent changes by forking instead of overwriting the other window', async () => {
    const saved = record()
    const { repository, records } = memoryRepository([saved])
    sessionStorage.setItem('lingui-creation-current:halo:alice', saved.id)
    const { snapshot, history } = await setup(repository)
    const latest = records.get(`halo:alice/${saved.id}`)!
    records.set(`halo:alice/${saved.id}`, {
      ...latest,
      revision: latest.revision + 1,
      instruction: '另一个窗口的修改',
    })
    snapshot.value = { ...snapshot.value, instruction: '本窗口的修改' }
    await history.flush()
    await flushPromises()
    expect(records.size).toBe(2)
    expect(records.get(`halo:alice/${saved.id}`)!.instruction).toBe('另一个窗口的修改')
    expect(history.activeId.value).not.toBe(saved.id)
    expect(
      history.entries.value.find((entry) => entry.id === history.activeId.value)!.instruction,
    ).toBe('本窗口的修改')
    expect(history.notice.value).toContain('另存')
  })
  it('reports save failure and preserves in-memory data for a retry', async () => {
    const { repository } = memoryRepository()
    vi.mocked(repository.save).mockRejectedValueOnce(new Error('存储空间不足'))
    const { snapshot, history } = await setup(repository)
    snapshot.value = { ...empty(), instruction: '不能丢失的需求' }
    await flushPromises()
    expect(history.error.value).toContain('空间不足')
    expect(snapshot.value.instruction).toBe('不能丢失的需求')
    await history.flush()
    expect(history.error.value).toBe('')
    expect(history.entries.value[0]!.instruction).toBe('不能丢失的需求')
  })
  it('reports invalid snapshots instead of claiming that history is saved', async () => {
    const { repository } = memoryRepository()
    const { snapshot, history } = await setup(repository)
    snapshot.value = { ...empty(), instruction: '字'.repeat(4001) }
    await flushPromises()
    expect(history.error.value).toContain('对话数据无效')
    expect(history.status.value).toBe('历史未保存')
    expect(repository.save).not.toHaveBeenCalled()
  })
  it('converts interrupted generation into a retryable error while retaining the source and instruction', () => {
    const saved = record()
    saved.messages = [
      { id: 1, role: 'user', text: '优化样式', status: 'pending' },
      { id: 2, role: 'assistant', text: '正在生成', status: 'pending', instruction: '优化样式' },
    ]
    const resumed = resumeSnapshot(saved)
    expect(resumed.instance).toEqual(saved.instance)
    expect(resumed.messages.every((message) => message.status === 'error')).toBe(true)
    expect(resumed.messages[1]!.text).toContain('中断')
    expect(resumed.messages[1]!.instruction).toBe('优化样式')
    expect(saved.messages[1]!.status).toBe('pending')
  })
  it('searches historical dialogue and emits the complete selected snapshot', async () => {
    const saved = record()
    view = mount(CreationHistoryDialog, {
      attachTo: document.body,
      props: {
        records: [saved, { ...record(), id: 'manual', messages: [], origin: 'blank' }],
        activeId: saved.id,
        loading: false,
        busy: false,
      },
    })
    await view.get('[aria-label="搜索创作历史"]').setValue('制作一组常见问题')
    expect(view.findAll('.lu-history-row')).toHaveLength(1)
    await view.get('.lu-history-open').trigger('click')
    expect(view.emitted('open')?.[0]).toEqual([saved])
    await view.get('[aria-label="清空搜索创作历史"]').trigger('click')
    expect(view.findAll('.lu-history-row')).toHaveLength(2)
  })
})
