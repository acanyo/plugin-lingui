import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createInstance, examples, resolveDocument } from '@lingui/renderer'
import { Dialog } from '@halo-dev/components'
import {
  createSubmission,
  exportSubmission,
  importSubmission,
  validateSubmission,
} from '../marketplace/submission'
import { builtinCatalog } from '../marketplace/catalog'
import { marketService } from '../marketplace/market-service'
import StudioView from '../views/StudioView.vue'
import { repositoryKey } from '../services/repository'
import { createLocalRepository } from '../dev/local-repository'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function completeDraft() {
  return {
    ...createSubmission(createInstance(examples[0]!.create())),
    author: '作者',
    description: '用途说明',
    category: '内容表达',
    license: 'GPL-3.0',
  }
}
describe('portable marketplace works', () => {
  it('exports a complete snapshot and imports it as a new independent draft', () => {
    const draft = completeDraft()
    draft.instance.parameters.title = '文章专用标题'
    draft.instance.templateId = 'site-project'
    draft.instance.templateVersion = 4
    const work = exportSubmission(draft)
    expect(work).not.toHaveProperty('id')
    expect(work).not.toHaveProperty('revision')
    expect(work.instance).not.toHaveProperty('templateId')
    const imported = importSubmission(JSON.stringify(work))
    expect(imported.id).not.toBe(draft.id)
    expect(imported.revision).toBe(0)
    expect(imported.instance.parameters.title).toBe('文章专用标题')
    expect(imported.instance.theme).toEqual(draft.instance.theme)
    imported.instance.document.title = '改编作品'
    expect(draft.instance.document.title).not.toBe('改编作品')
    expect(draft.instance.templateId).toBe('site-project')
  })
  it('allows incomplete drafts but requires listing metadata before export', () => {
    const draft = createSubmission(createInstance(examples[1]!.create()))
    expect(validateSubmission(draft)).toMatchObject({ author: '', license: '' })
    expect(() => exportSubmission(draft)).toThrow('作品简介')
    expect(() => exportSubmission({ ...completeDraft(), version: 'latest' })).toThrow('作品版本')
    expect(() => exportSubmission({ ...completeDraft(), license: 'unknown' })).toThrow('许可证')
  })
  it('revalidates untrusted component data and bounds uploaded package size', () => {
    const work = exportSubmission(completeDraft())
    const surface = resolveDocument(work.instance.document)
    expect(Object.keys(surface.nodes).length).toBeGreaterThan(1)
    const serialized = JSON.stringify(work).replace('Text(', 'UnsafeScript(')
    expect(() => importSubmission(serialized)).toThrow()
    expect(() => importSubmission(' '.repeat(524289))).toThrow('512 KiB')
    expect(() => importSubmission(JSON.stringify({ ...work, schemaVersion: 'unknown/1' }))).toThrow(
      '版本',
    )
  })
  it('keeps catalog definitions independent from editing copies', () => {
    const listing = builtinCatalog.list()[0]!
    const copy = listing.create()
    copy.title = '我的作品'
    expect(listing.create().title).not.toBe(copy.title)
  })
})
it('retains an edited project while browsing the market and guards replacement', async () => {
  const repository = { ...createLocalRepository(), mode: 'halo' as const }
  vi.spyOn(repository, 'listTemplates').mockResolvedValue([])
  vi.spyOn(repository, 'listThemes').mockResolvedValue([])
  const example = examples.find((work) => work.id === 'quiz')!
  vi.spyOn(marketService, 'list').mockResolvedValue({
    items: [{ name: 'work-quiz', title: example.title }],
    total: 1,
  })
  vi.spyOn(marketService, 'get').mockResolvedValue({
    ...example,
    id: 'work-quiz',
    source: 'community',
    publisher: '市场作者',
    license: 'MIT',
    version: '1.0.0',
  })
  const warning = vi.spyOn(Dialog, 'warning').mockImplementation(() => undefined as never)
  view = mount(StudioView, {
    props: { initialInstance: createInstance(examples[0]!.create()) },
    global: { provide: { [repositoryKey as symbol]: repository } },
  })
  await flushPromises()
  await view.get('input[aria-label="组件名称"]').setValue('保留未保存的项目')
  await view.get('input[aria-label="组件名称"]').trigger('change')
  const press = async (name: string) => {
    await view!
      .findAll('button')
      .find((button) => button.text().trim() === name)!
      .trigger('click')
    await flushPromises()
  }
  await press('组件市场')
  expect(view.find('.lu-market').exists()).toBe(true)
  await view.get('button[aria-label="使用知识测验"]').trigger('click')
  expect(warning).toHaveBeenCalledOnce()
  await press('开发工作台')
  expect((view.get('input[aria-label="组件名称"]').element as HTMLInputElement).value).toBe(
    '保留未保存的项目',
  )
})
