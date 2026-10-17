import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { createInstance, examples, pureTheme, type ComponentInstance } from '@lingui/renderer'
import ArticleProjectPicker from '../editor-extension/ArticleProjectPicker.vue'
import { marketProject } from '../editor-extension/market-download'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import { templateInstance, type TemplateRecord } from '../component-library/types'
import { marketService } from '../marketplace/market-service'
import type { MarketplaceWork } from '../marketplace/catalog'

let view: VueWrapper | undefined
const originalPermissions = utils.permission.getUserPermissions()
afterEach(() => {
  view?.unmount()
  view = undefined
  vi.restoreAllMocks()
  utils.permission.setUserPermissions(originalPermissions ?? [])
  document.body.replaceChildren()
})
function project(
  id = 'component-notice',
  name = '提示项目',
  category = '内容表达',
): TemplateRecord {
  return {
    id,
    name,
    category,
    description: '文章中的可复用组件',
    versionToken: 2,
    revisions: [
      {
        version: 3,
        createdAt: '2026-10-16T00:00:00Z',
        document: examples.find((item) => item.id === 'notice')!.create(),
        theme: { ...pureTheme, radius: 12 },
      },
    ],
  }
}
function work(): MarketplaceWork {
  const example = examples.find((item) => item.id === 'notice')!
  const instance = createInstance(example.create())
  instance.parameters.title = '市场配置的标题'
  return {
    ...example,
    id: 'work-notice',
    source: 'community',
    publisher: '市场作者',
    license: 'MIT',
    version: '1.0.0',
    instance,
  }
}
async function setup(initial: TemplateRecord[] = [], manage = true) {
  let records = structuredClone(initial)
  const repository = { ...createLocalRepository(), mode: 'halo' as const }
  const list = vi
    .spyOn(repository, 'listTemplates')
    .mockImplementation(async () => structuredClone(records))
  const save = vi.spyOn(repository, 'saveTemplate').mockImplementation(async (value) => {
    const saved = structuredClone({ ...value, versionToken: 1 })
    records.push(saved)
    return saved
  })
  const insert = vi.fn<(instance: ComponentInstance) => Promise<void>>().mockResolvedValue()
  const market = work()
  vi.spyOn(marketService, 'list').mockResolvedValue({
    items: [{ name: market.id, title: market.title }],
    total: 1,
  })
  vi.spyOn(marketService, 'get').mockResolvedValue(market)
  utils.permission.setUserPermissions(manage ? ['*'] : ['plugin:plugin-lingui:library:view'])
  view = mount(ArticleProjectPicker, {
    attachTo: document.body,
    props: { insert },
    global: { provide: { [repositoryKey as symbol]: repository } },
  })
  await flushPromises()
  return {
    list,
    save,
    insert,
    market,
    replace: (next: TemplateRecord[]) => {
      records = next
    },
  }
}
async function press(label: string) {
  const button = view!.findAll('button').find((item) => item.text().trim() === label)
  expect(button, `button ${label}`).toBeTruthy()
  await button!.trigger('click')
  await flushPromises()
}
async function marketTab() {
  await view!.get('[role="tab"][aria-selected="false"]').trigger('click')
  await flushPromises()
}
describe('article project selection', () => {
  it('starts with an empty project library and never creates a project while browsing', async () => {
    const { save, insert } = await setup()
    expect(view!.text()).toContain('还没有项目')
    expect(view!.find('.lu-article-picker-heading [aria-selected="true"]').text()).toContain(
      '我的项目',
    )
    expect(view!.get<HTMLButtonElement>('.lu-article-picker-footer button').element.disabled).toBe(
      true,
    )
    await press('浏览应用市场')
    expect(view!.find('[data-kind="theme"]').exists()).toBe(false)
    expect(view!.find('[aria-label="下载到我的项目重要提示"]').exists()).toBe(true)
    expect(view!.text()).not.toContain('准备投稿')
    expect(save).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })
  it('filters, previews and inserts an independent project snapshot with a version and theme', async () => {
    const original = project('component-A&B', '提示项目')
    const { save, insert } = await setup([original, project('other', '另一个项目', '表单')])
    await view!.get('[aria-label="筛选项目分类"]').setValue('内容表达')
    await view!.get('[aria-label="搜索我的项目"]').setValue('提示')
    expect(view!.findAll('.lu-project-picker-item')).toHaveLength(1)
    const edit = view!.get('.lu-article-preview-heading a')
    expect(edit.attributes('href')).toBe('/console/lingui?project=component-A%26B')
    expect(edit.attributes('target')).toBe('_blank')
    const shadow = view!.get('.lingui-renderer-host').element.shadowRoot!
    expect(shadow.textContent).toContain('提示')
    await press('插入文章')
    const snapshot = insert.mock.calls[0]![0]
    expect(snapshot).toEqual(templateInstance(original, pureTheme))
    expect(snapshot.templateVersion).toBe(3)
    snapshot.document.title = '文章独立副本'
    expect(original.name).toBe('提示项目')
    expect(save).not.toHaveBeenCalled()
  })
  it('saves a market work before making it available for explicit insertion and reuses existing downloads', async () => {
    const { save, insert, market, replace } = await setup()
    let complete!: (record: TemplateRecord) => void
    save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    await marketTab()
    await view!.get('[aria-label="下载到我的项目重要提示"]').trigger('click')
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
    expect(view!.text()).toContain('正在保存到我的项目')
    expect(view!.get('[aria-label="下载到我的项目重要提示"]').attributes('disabled')).toBeDefined()
    await view!.get('[aria-label="下载到我的项目重要提示"]').trigger('click')
    expect(save).toHaveBeenCalledTimes(1)
    const draft = save.mock.calls[0]![0]
    expect(draft.revisions[0]!.provenance?.[0]).toMatchObject({
      workId: market.id,
      version: '1.0.0',
      author: '市场作者',
    })
    expect(
      draft.revisions[0]!.document.parameters.find((item) => item.key === 'title')?.default,
    ).toBe('市场配置的标题')
    complete({ ...draft, versionToken: 1 })
    await flushPromises()
    expect(view!.get('.lu-article-picker-heading [aria-selected="true"]').text()).toContain(
      '我的项目',
    )
    expect(insert).not.toHaveBeenCalled()
    const saved = { ...draft, versionToken: 1 }
    replace([saved])
    expect(view!.get('.lu-article-preview-heading h3').text()).toBe('重要提示')
    expect(view!.get('.lu-article-preview-heading a').attributes('href')).toContain(saved.id)
    await press('插入文章')
    expect(insert.mock.calls[0]![0]).toMatchObject({
      templateId: saved.id,
      templateVersion: 1,
      parameters: { title: '市场配置的标题' },
    })
    await marketTab()
    await view!.get('[aria-label="下载到我的项目重要提示"]').trigger('click')
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
  })
  it('reuses an existing download and waits for the user to insert it', async () => {
    const saved = marketProject(work())
    const { save, insert } = await setup([saved])
    await marketTab()
    await view!.get('[aria-label="下载到我的项目重要提示"]').trigger('click')
    await flushPromises()
    expect(view!.text()).toContain('已选中下载过的项目')
    expect(save).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
    await press('插入文章')
    expect(insert.mock.calls[0]![0].templateId).toBe(saved.id)
  })
  it('leaves a failed download in the market with a retryable error and does not insert', async () => {
    const { save, insert } = await setup()
    save.mockRejectedValueOnce(new Error('下载保存失败'))
    await marketTab()
    await view!.get('[aria-label="下载到我的项目重要提示"]').trigger('click')
    await flushPromises()
    expect(view!.get('[role="alert"]').text()).toBe('下载保存失败')
    expect(view!.findAll('.lu-project-picker-item')).toHaveLength(0)
    expect(
      view!.get('[aria-label="下载到我的项目重要提示"]').attributes('disabled'),
    ).toBeUndefined()
    expect(insert).not.toHaveBeenCalled()
  })
  it('explains missing download permission while allowing existing projects to be inserted', async () => {
    const { save, insert } = await setup([project()], false)
    await marketTab()
    expect(view!.text()).toContain('下载需要「管理组件模板」权限')
    expect(view!.get('[aria-label="下载到我的项目重要提示"]').attributes('disabled')).toBeDefined()
    await marketTab()
    await press('插入文章')
    expect(insert).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
  })
  it('refreshes changed projects before insertion and reports projects removed in another window', async () => {
    const initial = project()
    const { insert, replace } = await setup([initial])
    const updated = { ...initial, name: '新名称', versionToken: 3 }
    replace([updated])
    await press('插入文章')
    expect(insert).not.toHaveBeenCalled()
    expect(view!.text()).toContain('预览已刷新')
    expect(view!.get('.lu-article-preview-heading h3').text()).toBe('新名称')
    await press('插入文章')
    expect(insert.mock.calls[0]![0].document.title).toBe('新名称')
    replace([])
    await press('插入文章')
    expect(view!.get('[role="alert"]').text()).toContain('已被删除')
    expect(insert).toHaveBeenCalledTimes(1)
  })
  it('prevents duplicate insertions while pending and allows retry after failure', async () => {
    const { insert } = await setup([project()])
    let reject!: (cause: Error) => void
    insert.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        }),
    )
    await press('插入文章')
    expect(view!.get<HTMLButtonElement>('.lu-article-picker-footer button').element.disabled).toBe(
      true,
    )
    expect(insert).toHaveBeenCalledTimes(1)
    reject(new Error('文章暂时无法写入'))
    await flushPromises()
    expect(view!.get('[role="alert"]').text()).toBe('文章暂时无法写入')
    await press('插入文章')
    expect(insert).toHaveBeenCalledTimes(2)
  })
})
