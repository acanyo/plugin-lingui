import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { Dialog, Toast } from '@halo-dev/components'
import { examples } from '@lingui/renderer'
import StudioView from '../views/StudioView.vue'
import type { TemplateRecord } from '../component-library/types'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import { marketService } from '../marketplace/market-service'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

async function setup(templates: TemplateRecord[] = [], mode: 'local' | 'halo' = 'local') {
  const repository = { ...createLocalRepository(), mode }
  vi.spyOn(repository, 'listTemplates').mockImplementation(async () => templates)
  vi.spyOn(repository, 'listThemes').mockResolvedValue([])
  const save = vi.spyOn(repository, 'saveTemplate').mockImplementation(async (record) => record)
  const remove = vi.spyOn(repository, 'deleteTemplate').mockImplementation(async (id) => {
    templates = templates.filter((template) => template.id !== id)
  })
  view = mount(StudioView, {
    attachTo: document.body,
    global: { provide: { [repositoryKey as symbol]: repository } },
  })
  await flushPromises()
  await press('我的项目')
  return { save, remove }
}
function project(): TemplateRecord {
  return {
    id: 'delete-project',
    name: '待删除项目',
    category: '内容表达',
    description: '',
    revisions: [{ version: 1, createdAt: '2026-10-11T00:00:00Z', document: examples[0]!.create() }],
  }
}
async function press(label: string) {
  await view!
    .findAll('button')
    .find((button) => button.text().trim() === label)!
    .trigger('click')
  await flushPromises()
}

describe('project lifecycle', () => {
  it('starts empty and does not persist projects when browsing or using market works', async () => {
    const work = examples.find((example) => example.id === 'quiz')!
    vi.spyOn(marketService, 'list').mockResolvedValue({
      items: [{ name: work.id, title: work.title }],
      total: 1,
    })
    vi.spyOn(marketService, 'get').mockResolvedValue({
      ...work,
      source: 'community',
      publisher: '市场作者',
      license: 'MIT',
      version: '1.0.0',
    })
    const { save } = await setup([], 'halo')
    expect(view!.get('.lu-project-empty').text()).toContain('还没有项目')
    expect(view!.find('.lu-projects-controls').exists()).toBe(false)
    expect(view!.find('.lu-project-filters').exists()).toBe(false)
    await press('组件市场')
    await view!.get('[aria-label="使用知识测验"]').trigger('click')
    await flushPromises()
    expect(view!.find('.lu-workspace-toolbar').exists()).toBe(true)
    expect(save).not.toHaveBeenCalled()
    await press('我的项目')
    expect(view!.get('.lu-project-empty').text()).toContain('还没有项目')
    expect(save).not.toHaveBeenCalled()
  })

  it('requires confirmation and returns to a clean empty state after deleting the last filtered project', async () => {
    const { remove } = await setup([project()])
    const warning = vi.spyOn(Dialog, 'warning').mockImplementation(() => undefined as never)
    const success = vi.spyOn(Toast, 'success').mockImplementation(() => undefined as never)
    await view!
      .findAll('.lu-project-filters button')
      .find((button) => button.text().startsWith('内容表达'))!
      .trigger('click')
    await view!.get('[aria-label="搜索项目"]').setValue('待删除')
    await view!.get('.lu-project-delete').trigger('click')
    expect(view!.get('.lu-project-delete').element.closest('details')).toBeNull()
    expect(remove).not.toHaveBeenCalled()
    expect(warning.mock.calls[0]![0]!.title).toBe('删除项目“待删除项目”？')
    await warning.mock.calls[0]![0]!.onConfirm?.()
    await flushPromises()
    expect(remove).toHaveBeenCalledExactlyOnceWith('delete-project')
    expect(view!.find('.lu-project-card').exists()).toBe(false)
    expect(view!.get('.lu-project-empty h3').text()).toBe('还没有项目')
    expect(view!.find('.lu-projects-controls').exists()).toBe(false)
    expect(success).toHaveBeenCalledWith('项目已删除')
  })

  it('retains the project and reports a failed deletion without a success message', async () => {
    const { remove } = await setup([project()])
    remove.mockRejectedValue(new Error('删除失败，请稍后重试'))
    const warning = vi.spyOn(Dialog, 'warning').mockImplementation(() => undefined as never)
    const success = vi.spyOn(Toast, 'success').mockImplementation(() => undefined as never)
    await view!.get('.lu-project-delete').trigger('click')
    await warning.mock.calls[0]![0]!.onConfirm?.()
    await flushPromises()
    expect(view!.findAll('.lu-project-card')).toHaveLength(1)
    expect(view!.get('.lu-global-error').text()).toContain('删除失败')
    expect(success).not.toHaveBeenCalled()
  })
})
