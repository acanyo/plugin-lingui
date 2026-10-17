import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { examples, pureTheme } from '@lingui/renderer'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import { projectSubmission } from '../marketplace/project-submission'
import SubmissionProjectDialog from '../marketplace/SubmissionProjectDialog.vue'
import SubmissionWorkspace from '../marketplace/SubmissionWorkspace.vue'
import SubmissionEditor from '../marketplace/SubmissionEditor.vue'
import SendSubmissionDialog from '../marketplace/SendSubmissionDialog.vue'
import MarketConnectionDialog from '../marketplace/MarketConnectionDialog.vue'
import { exportSubmission, type SubmissionDraft } from '../marketplace/submission'
import { marketService } from '../marketplace/market-service'
import { localSubmissionRepository } from '../marketplace/draft-repository'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import type { TemplateRecord } from '../component-library/types'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function project(): TemplateRecord {
  return {
    id: 'my-project',
    name: '我的交互作品',
    category: '内容表达',
    description: '已保存的项目说明',
    revisions: [1, 4].map((version) => ({
      version,
      createdAt: `2026-10-0${version}T00:00:00Z`,
      document: examples[0]!.create(),
    })),
  }
}
function completeDraft(): SubmissionDraft {
  return { ...projectSubmission(project(), '作者'), license: 'MIT' }
}
async function press(name: string) {
  await view!
    .findAll('button')
    .find((button) => button.text().trim() === name)!
    .trigger('click')
  await flushPromises()
}
describe('project publication entry', () => {
  it('captures the latest saved revision and listing metadata independently of the project', () => {
    const source = project(),
      draft = projectSubmission(source, '作者')
    expect(draft).toMatchObject({
      title: source.name,
      description: source.description,
      category: source.category,
      author: '作者',
      version: '1.0.0',
    })
    expect(draft.instance.templateVersion).toBe(4)
    expect(draft.instance.parameters).toEqual(
      Object.fromEntries(
        source.revisions
          .at(-1)!
          .document.parameters.map((parameter) => [parameter.key, parameter.default]),
      ),
    )
    expect(draft.instance.theme).toEqual(pureTheme)
    draft.instance.document.title = '投稿副本'
    expect(source.name).toBe('我的交互作品')
    expect(exportSubmission({ ...draft, license: 'MIT' }).instance).not.toHaveProperty('templateId')
  })
  it('reads saved projects, searches them and selects a preview without changing the repository', async () => {
    const repository = createLocalRepository()
    vi.spyOn(repository, 'listTemplates').mockResolvedValue([project()])
    const save = vi.spyOn(repository, 'saveTemplate')
    view = mount(SubmissionProjectDialog, {
      props: { author: '市场作者' },
      global: { provide: { [repositoryKey as symbol]: repository } },
    })
    await flushPromises()
    await view.get('[aria-label="搜索投稿项目"]').setValue('不存在')
    expect(view.text()).toContain('没有匹配的项目')
    await view.get('[aria-label="搜索投稿项目"]').setValue('内容表达')
    await view.get('.lu-project-picker-item').trigger('click')
    expect(view.find('.lu-project-picker-preview .lingui-renderer-host').exists()).toBe(true)
    await press('下一步：填写作品说明')
    expect(view.emitted('selected')?.[0]?.[0]).toMatchObject({
      title: '我的交互作品',
      author: '市场作者',
    })
    expect(save).not.toHaveBeenCalled()
  })
  it('reports a project loading failure and retries instead of displaying a false empty state', async () => {
    const repository = createLocalRepository()
    vi.spyOn(repository, 'listTemplates')
      .mockRejectedValueOnce(new Error('项目读取失败'))
      .mockResolvedValueOnce([])
    view = mount(SubmissionProjectDialog, {
      global: { provide: { [repositoryKey as symbol]: repository } },
    })
    await flushPromises()
    expect(view.text()).toContain('项目读取失败')
    expect(view.text()).not.toContain('还没有保存的项目')
    await press('重新加载')
    expect(view.text()).toContain('还没有保存的项目')
  })
  it('retains the saved draft through account connection and opens confirmation without posting', async () => {
    vi.spyOn(localSubmissionRepository, 'list').mockResolvedValue([])
    vi.spyOn(localSubmissionRepository, 'save').mockImplementation(async (draft) => ({
      ...draft,
      revision: 1,
    }))
    vi.spyOn(marketService, 'connection').mockResolvedValue({ connected: false })
    vi.spyOn(marketService, 'mine').mockResolvedValue({ items: [], total: 0 })
    const send = vi.spyOn(marketService, 'send')
    view = mount(SubmissionWorkspace, { props: { sourceDraft: completeDraft() } })
    await flushPromises()
    view.findComponent(SubmissionEditor).vm.$emit('submit', completeDraft())
    await flushPromises()
    expect(view.findComponent(MarketConnectionDialog).exists()).toBe(true)
    view
      .findComponent(MarketConnectionDialog)
      .vm.$emit('connected', { connected: true, username: 'author' })
    await flushPromises()
    expect(view.findComponent(SendSubmissionDialog).props('draft')).toMatchObject({
      title: '我的交互作品',
      revision: 1,
    })
    expect(send).not.toHaveBeenCalled()
  })
  it('includes the last form input when saving and submitting directly', async () => {
    view = mount(SubmissionEditor, {
      props: { draft: completeDraft(), busy: false, remoteEnabled: true },
      global: { plugins: [[formkit, defaultConfig()]] },
    })
    await view.get('input[name="title"]').setValue('最终投稿名称')
    await press('保存并投稿')
    await view.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 100))
    await flushPromises()
    expect(view.emitted('submit')?.[0]?.[0]).toMatchObject({ title: '最终投稿名称' })
    expect(view.emitted('save')).toBeUndefined()
  })
})
