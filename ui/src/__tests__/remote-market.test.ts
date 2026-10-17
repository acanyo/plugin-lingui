import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, examples, validateInstance, builtInThemes } from '@lingui/renderer'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import { marketService } from '../marketplace/market-service'
import { LinguiMarketApi } from '../api/generated'
import CommunityCatalog from '../marketplace/CommunityCatalog.vue'
import SendSubmissionDialog from '../marketplace/SendSubmissionDialog.vue'
import RemoteSubmissionDetail from '../marketplace/RemoteSubmissionDetail.vue'
import MarketConnectionDialog from '../marketplace/MarketConnectionDialog.vue'
import { createSubmission, exportSubmission } from '../marketplace/submission'
import { themeSubmission } from '../marketplace/theme-submission'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.replaceChildren()
})
function draft() {
  const instance = createInstance(examples[0]!.create())
  return {
    ...createSubmission(instance),
    title: '社区测试作品',
    description: '真实交互作品',
    author: '投稿者',
    category: '内容表达',
    license: 'MIT',
  }
}
async function press(name: string) {
  await view!
    .findAll('button')
    .find((b) => b.text().trim() === name)!
    .trigger('click')
  await flushPromises()
}
describe('remote marketplace integration', () => {
  it('switches type before pagination, preserves search, and ignores an obsolete tab response', async () => {
    vi.useFakeTimers()
    let oldResponse!: (value: {
      items: []
      total: number
      componentTotal: number
      themeTotal: number
    }) => void
    const list = vi
      .spyOn(marketService, 'list')
      .mockImplementation(async (_page, _query, kind) => ({
        items: [],
        total: kind === 'theme' ? 1 : 20,
        componentTotal: 20,
        themeTotal: 1,
      }))
    view = mount(CommunityCatalog, { attachTo: document.body })
    await flushPromises()
    expect(view.get('[role=tab][aria-selected=true]').text()).toBe('组件20')
    await view.get('[aria-label="搜索市场作品"]').setValue('阅读')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResponse = resolve
        }),
    )
    await view.get('[aria-label="下一页"]').trigger('click')
    await flushPromises()
    const theme = view.get<HTMLButtonElement>('[role=tab][data-kind=theme]')
    await theme.trigger('click')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, '阅读', 'theme')
    expect(theme.attributes('aria-selected')).toBe('true')
    expect(view.get<HTMLInputElement>('[aria-label="搜索市场作品"]').element.value).toBe('阅读')
    expect(view.find('[aria-label="下一页"]').exists()).toBe(false)
    oldResponse({ items: [], total: 100, componentTotal: 100, themeTotal: 0 })
    await flushPromises()
    expect(theme.text()).toBe('主题1')
    await theme.trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    const component = view.get<HTMLButtonElement>('[role=tab][data-kind=component]')
    expect(component.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(component.element)
    expect(list).toHaveBeenLastCalledWith(1, '阅读', 'component')
  })

  it('keeps the full public snapshot and removes site-specific project identity', async () => {
    const submission = draft()
    submission.instance.parameters.title = '定制标题'
    submission.instance.theme = builtInThemes[1]!
    submission.instance.templateId = 'foreign-site-project'
    submission.instance.templateVersion = 4
    const payload = exportSubmission(submission)
    vi.spyOn(LinguiMarketApi.prototype, 'getCommunityWork').mockResolvedValue({
      data: { work: { name: 'work-community' }, packageJson: JSON.stringify(payload) },
    } as never)
    const work = await marketService.get('work-community')
    expect(work.instance?.parameters.title).toBe('定制标题')
    expect(work.instance?.theme).toEqual(submission.instance.theme)
    expect(work.instance).not.toHaveProperty('templateId')
    const copy = validateInstance(work.instance)
    copy.document.title = '编辑副本'
    expect(work.instance?.document.title).toBe(submission.instance.document.title)
  })
  it('loads a published theme as a theme while preserving its full styling snapshot', async () => {
    const source = {
      ...themeSubmission(builtInThemes[1]!, '主题作者'),
      description: '用于阅读的主题',
      license: 'MIT',
    }
    vi.spyOn(LinguiMarketApi.prototype, 'getCommunityWork').mockResolvedValue({
      data: {
        work: { name: 'theme-public' },
        packageJson: JSON.stringify(exportSubmission(source)),
      },
    } as never)
    const work = await marketService.get('theme-public')
    expect(work.kind).toBe('theme')
    expect(work.icon).toBe('palette')
    expect(work.instance?.theme).toEqual(source.instance.theme)
  })
  it('does not allow an unsafe public package into the renderer', async () => {
    const payload = JSON.stringify(exportSubmission(draft())).replace('Text(', 'UnsafeScript(')
    vi.spyOn(LinguiMarketApi.prototype, 'getCommunityWork').mockResolvedValue({
      data: { work: { name: 'work-community' }, packageJson: payload },
    } as never)
    await expect(marketService.get('work-community')).rejects.toThrow()
  })
  it('distinguishes a failed market from a genuinely empty market and can retry', async () => {
    const list = vi
      .spyOn(marketService, 'list')
      .mockRejectedValueOnce(new Error('连接失败'))
      .mockResolvedValueOnce({ items: [], total: 0, componentTotal: 0, themeTotal: 0 })
    view = mount(CommunityCatalog)
    await flushPromises()
    expect(view.text()).toContain('暂时无法读取市场作品')
    expect(view.text()).not.toContain('暂无已上架组件')
    await press('重试')
    expect(list).toHaveBeenCalledTimes(2)
    expect(view.text()).toContain('暂无已上架组件')
  })
  it('does not replace the latest search with an older response', async () => {
    vi.useFakeTimers()
    let first: (value: { items: []; total: number }) => void = () => undefined
    vi.spyOn(marketService, 'list')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve
          }),
      )
      .mockResolvedValueOnce({ items: [], total: 0, componentTotal: 0, themeTotal: 0 })
    view = mount(CommunityCatalog)
    await view.get('[aria-label="搜索市场作品"]').setValue('new search')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    first({ items: [], total: 15 })
    await flushPromises()
    expect(view.get('[role=tab][aria-selected=true]').text()).toBe('组件0')
  })
  it('shows the actual market page size and returns to the first page for a new search', async () => {
    vi.useFakeTimers()
    const list = vi.spyOn(marketService, 'list').mockResolvedValue({ items: [], total: 20 })
    view = mount(CommunityCatalog)
    await flushPromises()
    const selects = view.findAll('.pagination select')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('9')
    expect(view.get('.lu-pagination-summary').text()).toBe('第 1–9 件，共 20 件')
    expect(view.get('[aria-label="上一页"]').attributes('disabled')).toBeDefined()
    expect(view.find('[aria-label="跳转页码"]').exists()).toBe(true)
    await selects[0]!.setValue('2')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(2, '', 'component')
    expect(view.get('.lu-pagination-summary').text()).toBe('第 10–18 件，共 20 件')
    await view.get('[aria-label="下一页"]').trigger('click')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(3, '', 'component')
    expect(view.get('.lu-pagination-summary').text()).toBe('第 19–20 件，共 20 件')
    expect(view.get('[aria-label="下一页"]').attributes('disabled')).toBeDefined()
    await view.get('[aria-label="搜索市场作品"]').setValue('阅读')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, '阅读', 'component')
    expect((view.findAll('.pagination select')[0]!.element as HTMLSelectElement).value).toBe('1')
  })
  it('creates a submission only after confirmation and blocks repeated clicks until completion', async () => {
    vi.spyOn(marketService, 'mine').mockResolvedValue({ items: [], total: 0 })
    let complete: (value: {}) => void = () => undefined
    const send = vi.spyOn(marketService, 'send').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    view = mount(SendSubmissionDialog, { props: { draft: draft() }, attachTo: document.body })
    await flushPromises()
    expect(send).not.toHaveBeenCalled()
    await press('确认投稿')
    expect(send).toHaveBeenCalledTimes(1)
    expect(view.emitted('sent')).toBeUndefined()
    complete({ name: 'work-new' })
    await flushPromises()
    expect(view.emitted('sent')).toHaveLength(1)
  })
  it('rechecks the selected work before posting a revision and refuses an existing pending version', async () => {
    vi.spyOn(marketService, 'mine').mockResolvedValue({
      items: [{ name: 'work-existing', title: '原作品', status: 'REJECTED' }],
      total: 1,
    })
    vi.spyOn(marketService, 'detail').mockResolvedValue({
      name: 'work-existing',
      resourceVersion: 3,
      revisions: [{ status: 'PENDING' }],
    })
    const send = vi.spyOn(marketService, 'send')
    view = mount(SendSubmissionDialog, { props: { draft: draft() } })
    await flushPromises()
    await view.get('select').setValue('work-existing')
    await press('确认投稿')
    expect(send).not.toHaveBeenCalled()
    expect(view.text()).toContain('已有待审版本')
  })
  it('refuses replacing a component with a theme before sending a revision', async () => {
    vi.spyOn(marketService, 'mine').mockResolvedValue({
      items: [{ name: 'work-existing', title: '原组件', status: 'APPROVED' }],
      total: 1,
    })
    vi.spyOn(marketService, 'detail').mockResolvedValue({
      name: 'work-existing',
      resourceVersion: 4,
      revisions: [{ status: 'APPROVED', packageJson: JSON.stringify(exportSubmission(draft())) }],
    })
    const send = vi.spyOn(marketService, 'send')
    view = mount(SendSubmissionDialog, {
      props: {
        draft: {
          ...themeSubmission(builtInThemes[1]!, '作者'),
          description: '主题说明',
          license: 'MIT',
        },
      },
    })
    await flushPromises()
    await view.get('select').setValue('work-existing')
    await press('确认投稿')
    expect(send).not.toHaveBeenCalled()
    expect(view.text()).toContain('组件与主题不能互相替换')
  })
  it('uses the freshly loaded optimistic-lock version when updating an existing work', async () => {
    vi.spyOn(marketService, 'mine').mockResolvedValue({
      items: [{ name: 'work-existing', title: '原作品', status: 'REJECTED', resourceVersion: 1 }],
      total: 1,
    })
    vi.spyOn(marketService, 'detail').mockResolvedValue({
      name: 'work-existing',
      resourceVersion: 7,
      revisions: [{ status: 'REJECTED' }],
    })
    const send = vi.spyOn(marketService, 'send').mockResolvedValue({ name: 'work-existing' })
    view = mount(SendSubmissionDialog, { props: { draft: draft() } })
    await flushPromises()
    await view.get('select').setValue('work-existing')
    await press('确认投稿')
    expect(send).toHaveBeenCalledWith(expect.any(Object), {
      name: 'work-existing',
      resourceVersion: 7,
    })
  })
  it('shows real review feedback and copies remote content into an independent draft', async () => {
    view = mount(RemoteSubmissionDetail, {
      props: {
        detail: {
          name: 'work-owned',
          resourceVersion: 5,
          revisions: [
            {
              id: 'revision-a',
              version: '1.0.0',
              title: '我的作品',
              status: 'REJECTED',
              reviewNote: '请完善来源说明',
              packageJson: JSON.stringify(exportSubmission(draft())),
            },
          ],
        },
      },
    })
    await flushPromises()
    expect(view.text()).toContain('请完善来源说明')
    await press('复制为修改草稿')
    expect(view.emitted('edit')?.[0]?.[0]).toMatchObject({ revision: 0, title: '社区测试作品' })
  })
  it('clears the entered credential after connection failure', async () => {
    vi.spyOn(marketService, 'connect').mockRejectedValue(new Error('令牌无效'))
    view = mount(MarketConnectionDialog, { global: { plugins: [[formkit, defaultConfig()]] } })
    await view.get('input[type="password"]').setValue('test-only-token')
    await view.get('form').trigger('submit')
    await flushPromises()
    // Wait for FormKit's debounced input and submission instead of a fixed wall-clock delay.
    await vi.waitFor(() => {
      expect(view!.text()).toContain('令牌无效')
      expect((view!.get('input[type="password"]').element as HTMLInputElement).value).toBe('')
    })
  })
})
