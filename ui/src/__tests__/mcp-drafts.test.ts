import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import { createInstance, pureTheme, type LinguiDocument } from '@lingui/renderer'
import { utils } from '@halo-dev/ui-shared'
import { reviewDraft } from '../mcp/history/review'
import {
  createMcpHistoryClient,
  type McpHistoryClient,
  type DraftDetail,
} from '../mcp/history/client'
import McpInboxDialog from '../mcp/history/McpInboxDialog.vue'
import StudioView from '../views/StudioView.vue'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import { creationHistoryRepository } from '../creation-history/repository'
import type { TemplateRecord } from '../component-library/types'

vi.mock('../mcp/history/client', () => ({ createMcpHistoryClient: vi.fn() }))
vi.mock('../creation-history/history-scope', async () => {
  const { ref } = await import('vue')
  return { useHistoryScope: () => ref('mcp-draft-tests') }
})
const oldPermissions = utils.permission.getUserPermissions()
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  utils.permission.setUserPermissions(oldPermissions ?? [])
  vi.restoreAllMocks()
  document.body.replaceChildren()
  localStorage.clear()
})
function documentFor(text: string): LinguiDocument {
  return {
    schemaVersion: 'lingui.document/2',
    title: text,
    parameters: [],
    state: {},
    source: `root = Text(${JSON.stringify({ id: 'root', text })}, [])`,
  }
}
function detail(target = false): DraftDetail {
  return {
    draft: {
      id: 'draft-one',
      title: '外部草稿',
      kind: 'component',
      keyName: 'Codex',
      createdAt: '2026-10-15T00:00:00Z',
      ...(target ? { workName: 'work-one', baseRevision: 1 } : {}),
    },
    design: JSON.stringify({ document: documentFor('修改后的作品') }),
  }
}
function project(): TemplateRecord {
  return {
    id: 'work-one',
    name: '原作品',
    category: '内容',
    description: '',
    revisions: [{ version: 1, createdAt: '2026-10-14T00:00:00Z', document: documentFor('原作品') }],
  }
}
function client(value = detail()): McpHistoryClient {
  return {
    drafts: vi.fn().mockResolvedValue([value.draft]),
    activities: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(value),
    loaded: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}
const global = {
  plugins: [[formkit, defaultConfig()]] as [typeof formkit, ReturnType<typeof defaultConfig>][],
  stubs: { teleport: true, transition: false, LinguiRenderer: true },
}
async function press(text: string) {
  const button = wrapper!.findAll('button').find((button) => button.text().trim() === text)
  expect(button, text).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}
describe('external AI draft review', () => {
  it('previews only the selected properties before emitting a reviewed selection', async () => {
    const value = detail(true)
    wrapper = mount(McpInboxDialog, {
      attachTo: window.document.body,
      global,
      props: {
        drafts: [value.draft!],
        activities: [],
        loading: false,
        busy: false,
        error: '',
        client: client(value),
        load: async () => reviewDraft(value, [project()]),
      },
    })
    await wrapper.get('[aria-label="外部 AI 草稿列表"] button').trigger('click')
    await flushPromises()
    const label = wrapper.findAll('label').find((label) => label.text().includes('root · text'))!
    expect(label).toBeDefined()
    await label.get('input').setValue(false)
    await flushPromises()
    const rendered = wrapper.findAllComponents({ name: 'LinguiRenderer' })
    await vi.waitFor(() =>
      expect(rendered.at(-1)!.props('instance').document.source).toContain('原作品'),
    )
    await press('确认并载入编辑')
    const selection = wrapper.emitted('apply')?.[0]?.[2] as { keys: string[] }
    expect(selection.keys.every((key) => !key.includes('text'))).toBe(true)
  })
  it('keeps the dialog closable and history browsable while the active creation is blocked', async () => {
    const value = detail()
    wrapper = mount(McpInboxDialog, {
      attachTo: window.document.body,
      global,
      props: {
        drafts: [value.draft!],
        activities: [],
        loading: false,
        busy: true,
        error: '',
        client: client(),
        load: async () => reviewDraft(value, []),
      },
    })
    await wrapper.get('[aria-label="外部 AI 草稿列表"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('当前创作处理中')
    await press('返回工作台')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
  it('validates canonical designs, shows component changes and guards stale or deleted targets', () => {
    const draft = detail(true)
    const review = reviewDraft(draft, [project()])
    expect(review.changes.join(' ')).toContain('root')
    expect(review.base?.document.title).toBe('原作品')
    expect(review.conflict).toBe('')
    const newer = project()
    newer.revisions.push({ ...newer.revisions[0]!, version: 2 })
    expect(reviewDraft(draft, [newer]).conflict).toContain('项目现为 v2')
    expect(reviewDraft(draft, []).conflict).toContain('原项目已删除')
    expect(() => reviewDraft({ ...draft, design: '{}' }, [])).toThrow()
    expect(
      reviewDraft(
        { draft: { ...draft.draft, kind: 'theme' }, design: JSON.stringify(pureTheme) },
        [],
      ).theme?.id,
    ).toBe(pureTheme.id)
  })
  it('requires an explicit selection and load, keeps old drafts restorable and previews with no interaction host', async () => {
    const api = client()
    const old = { ...detail().draft!, loadedAt: '2026-10-15T01:00:00Z' }
    wrapper = mount(McpInboxDialog, {
      attachTo: window.document.body,
      global,
      props: {
        drafts: [old],
        activities: [],
        loading: false,
        busy: false,
        error: '',
        client: api,
        load: async () => reviewDraft({ ...detail(), draft: old }, []),
      },
    })
    expect(api.get).not.toHaveBeenCalled()
    expect(wrapper.emitted('apply')).toBeUndefined()
    await wrapper.get('[aria-label="外部 AI 草稿列表"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('改动内容')
    expect(wrapper.getComponent({ name: 'LinguiRenderer' }).props('interactions')).toBeUndefined()
    expect(api.loaded).not.toHaveBeenCalled()
    await press('重新载入此版本')
    expect(wrapper.emitted('apply')?.[0]?.[1]).toBe(true)
  })
  it('ignores a late detail response after another draft was selected', async () => {
    let resolveFirst: (value: ReturnType<typeof reviewDraft>) => void = () => {}
    const first = detail()
    const second = { ...first, draft: { ...first.draft!, id: 'draft-two', title: '第二版' } }
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce(reviewDraft(second, []))
    wrapper = mount(McpInboxDialog, {
      attachTo: window.document.body,
      global,
      props: {
        drafts: [first.draft!, second.draft!],
        activities: [],
        loading: false,
        busy: false,
        error: '',
        client: client(),
        load,
      },
    })
    const buttons = wrapper.findAll('[aria-label="外部 AI 草稿列表"] button')
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    await flushPromises()
    resolveFirst(reviewDraft(first, []))
    await flushPromises()
    expect(wrapper.get('.lu-inbox-detail h3').text()).toBe('第二版')
  })
  it('loads a received draft into the workbench without saving or publishing, and retains undo history', async () => {
    const api = client()
    vi.mocked(createMcpHistoryClient).mockReturnValue(api)
    utils.permission.setUserPermissions([
      'plugin:plugin-lingui:mcp:use',
      'plugin:plugin-lingui:components:manage',
    ])
    const repository = { ...createLocalRepository(), mode: 'halo' as const }
    vi.spyOn(repository, 'listTemplates').mockResolvedValue([])
    vi.spyOn(repository, 'listThemes').mockResolvedValue([])
    const save = vi.spyOn(repository, 'saveTemplate')
    vi.spyOn(creationHistoryRepository, 'list').mockResolvedValue([])
    vi.spyOn(creationHistoryRepository, 'save').mockImplementation(async (record) => ({
      ...record,
      revision: record.revision + 1,
    }))
    wrapper = mount(StudioView, {
      attachTo: window.document.body,
      props: { initialInstance: createInstance(documentFor('原先的本地修改')) },
      global: {
        ...global,
        stubs: {
          ...global.stubs,
          PreviewPresentation: {
            template: '<div><slot :fullscreen="false" mode="preview" /></div>',
          },
        },
        provide: { [repositoryKey as symbol]: repository },
      },
    })
    await flushPromises()
    const open = wrapper.findAll('button').find((button) => button.text().includes('外部 AI 草稿'))!
    await open.trigger('click')
    await flushPromises()
    await wrapper.get('[aria-label="外部 AI 草稿列表"] button').trigger('click')
    await flushPromises()
    expect(save).not.toHaveBeenCalled()
    await press('确认并载入编辑')
    await vi.waitFor(() => expect(api.loaded).toHaveBeenCalledWith('draft-one'))
    expect(save).not.toHaveBeenCalled()
    expect(wrapper.get('input[name="component-title"]').element).toHaveProperty(
      'value',
      '修改后的作品',
    )
    expect(wrapper.text()).toContain('未保存')
    expect(wrapper.get('[aria-label="撤销修改"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[aria-label="撤销修改"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('新作品')
  })
})
