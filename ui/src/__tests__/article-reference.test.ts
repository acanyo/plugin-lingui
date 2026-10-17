import { describe, expect, it, vi } from 'vitest'
import { createInstance, examples, pureTheme } from '@lingui/renderer'
import { prepareArticleProject } from '../editor-extension/prepare-project'
import { ensurePublicEmbed } from '../component-embed/ensure-public'
import { createLocalRepository } from '../dev/local-repository'
import { templateInstance, type TemplateRecord } from '../component-library/types'
import type { EmbedClient } from '../component-embed/client'

function setup() {
  let records: TemplateRecord[] = []
  const repository = { ...createLocalRepository(), mode: 'halo' as const }
  const list = vi
    .spyOn(repository, 'listTemplates')
    .mockImplementation(async () => structuredClone(records))
  const save = vi.spyOn(repository, 'saveTemplate').mockImplementation(async (value) => {
    const saved = structuredClone({ ...value, versionToken: (value.versionToken ?? 0) + 1 })
    records = [saved, ...records.filter((record) => record.id !== value.id)]
    return saved
  })
  return { repository, save, list, records: () => records }
}
function instance() {
  return createInstance(examples.find((item) => item.id === 'notice')!.create())
}
const signal = () => new AbortController().signal

describe('article reference preparation', () => {
  it('saves creation parameters as project defaults and reuses that project on retry', async () => {
    const { repository, save, records } = setup()
    const work = instance()
    work.parameters.title = '文章中的标题'
    const saved = await prepareArticleProject(work, repository, true, signal())
    expect(saved.templateId).toMatch(/^component-/)
    expect(saved.parameters.title).toBe('文章中的标题')
    expect(
      records()[0]!.revisions[0]!.document.parameters.find((item) => item.key === 'title')!.default,
    ).toBe('文章中的标题')
    expect(work.document.parameters.find((item) => item.key === 'title')!.default).not.toBe(
      '文章中的标题',
    )
    await prepareArticleProject(saved, repository, true, signal())
    expect(save).toHaveBeenCalledTimes(1)
    const changed = { ...saved, parameters: { ...saved.parameters, title: '修改后的标题' } }
    const updated = await prepareArticleProject(changed, repository, true, signal())
    expect(updated.templateId).toBe(saved.templateId)
    expect(updated.templateVersion).toBe(2)
    expect(records()).toHaveLength(1)
  })
  it('allows readers to reference existing data but prevents creating projects or overwriting newer revisions', async () => {
    const { repository, save, records } = setup()
    await expect(prepareArticleProject(instance(), repository, false, signal())).rejects.toThrow(
      '组件管理权限',
    )
    const saved = await prepareArticleProject(instance(), repository, true, signal())
    await expect(prepareArticleProject(saved, repository, false, signal())).resolves.toMatchObject({
      templateId: saved.templateId,
    })
    const changed = { ...saved, parameters: { ...saved.parameters, title: '新标题' } }
    await prepareArticleProject(changed, repository, true, signal())
    await expect(prepareArticleProject(saved, repository, true, signal())).rejects.toThrow(
      '项目已更新',
    )
    expect(save).toHaveBeenCalledTimes(2)
    expect(templateInstance(records()[0]!, pureTheme).parameters.title).toBe('新标题')
  })
  it('fails before saving deleted projects and cancelled requests', async () => {
    const { repository, save } = setup()
    await expect(
      prepareArticleProject({ ...instance(), templateId: 'deleted' }, repository, true, signal()),
    ).rejects.toThrow('已被删除')
    const controller = new AbortController()
    controller.abort()
    await expect(
      prepareArticleProject(instance(), repository, true, controller.signal),
    ).rejects.toThrow('取消')
    expect(save).not.toHaveBeenCalled()
  })
  it('only enables an unpublished project with manage permission and propagates publication failures', async () => {
    const client: EmbedClient = {
      status: vi.fn(async (name) => ({ name, enabled: false, revision: 1 })),
      enable: vi.fn(async (name) => ({ name, enabled: true, revision: 1 })),
      disable: vi.fn(),
    }
    await expect(ensurePublicEmbed(client, 'weather', false, signal())).rejects.toThrow(
      '尚未开启公开嵌入',
    )
    expect(client.enable).not.toHaveBeenCalled()
    await ensurePublicEmbed(client, 'weather', true, signal())
    expect(client.enable).toHaveBeenCalledTimes(1)
    vi.mocked(client.status).mockResolvedValueOnce({ name: 'weather', enabled: true, revision: 1 })
    await ensurePublicEmbed(client, 'weather', false, signal())
    expect(client.enable).toHaveBeenCalledTimes(1)
    vi.mocked(client.enable).mockRejectedValueOnce(new Error('公开设置写入失败'))
    await expect(ensurePublicEmbed(client, 'weather', true, signal())).rejects.toThrow(
      '公开设置写入失败',
    )
  })
})
