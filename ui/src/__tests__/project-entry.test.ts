import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, examples } from '@lingui/renderer'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import StudioView from '../views/StudioView.vue'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import { creationHistoryRepository } from '../creation-history/repository'
import type { TemplateRecord } from '../component-library/types'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  view = undefined
  vi.restoreAllMocks()
  sessionStorage.clear()
  document.body.replaceChildren()
})
const target: TemplateRecord = {
  id: 'component-target',
  name: '从文章打开的项目',
  category: '内容表达',
  description: '',
  revisions: [{ version: 2, createdAt: '2026-10-16T00:00:00Z', document: examples[0]!.create() }],
}
async function setup(projectId: string) {
  const repository = createLocalRepository()
  vi.spyOn(repository, 'listTemplates').mockResolvedValue([structuredClone(target)])
  vi.spyOn(repository, 'listThemes').mockResolvedValue([])
  const save = vi.spyOn(repository, 'saveTemplate')
  const now = new Date().toISOString()
  vi.spyOn(creationHistoryRepository, 'list').mockResolvedValue([
    {
      id: 'previous',
      scope: 'local',
      revision: 1,
      origin: 'ai',
      createdAt: now,
      updatedAt: now,
      messages: [],
      instruction: '保留旧草稿',
      dirty: true,
      editing: false,
      instance: createInstance(examples[1]!.create()),
    },
  ])
  vi.spyOn(creationHistoryRepository, 'save').mockImplementation(async (record) => ({
    ...record,
    revision: record.revision + 1,
  }))
  sessionStorage.setItem('lingui-creation-current:local', 'previous')
  view = mount(StudioView, {
    attachTo: document.body,
    props: { projectId },
    global: {
      provide: { [repositoryKey as symbol]: repository },
      plugins: [[formkit, defaultConfig()]],
    },
  })
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
  return { save }
}
describe('project editor links', () => {
  it('opens the requested project in manual editing and preserves the previous creation history', async () => {
    const { save } = await setup(target.id)
    const workspace = view!.getComponent(CreationWorkspace)
    expect(workspace.props('instance')).toMatchObject({
      templateId: target.id,
      templateVersion: 2,
      document: { title: target.name },
    })
    expect(workspace.props('initialEditing')).toBe(true)
    expect(sessionStorage.getItem('lingui-creation-current:local')).toBe('previous')
    expect(save).not.toHaveBeenCalled()
  })
  it('shows a missing-project error and can subsequently open another linked project', async () => {
    const { save } = await setup('component-deleted')
    expect(view!.get('.lu-global-error').text()).toContain('该项目不存在或已被删除')
    expect(view!.find('.lu-artifact-canvas').exists()).toBe(false)
    await view!.setProps({ projectId: target.id })
    await flushPromises()
    expect(view!.getComponent(CreationWorkspace).props('instance')?.templateId).toBe(target.id)
    expect(view!.find('.lu-global-error').exists()).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })
})
