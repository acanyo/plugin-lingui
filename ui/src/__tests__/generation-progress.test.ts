import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { examples, type LinguiDocument } from '@lingui/renderer'
import AiComposer from '../ai-adapter/AiComposer.vue'
import { repositoryKey } from '../services/repository'
import { createHaloRepository } from '../services/halo-repository'
import type { GenerationOptions, GenerationTrace } from '../ai-adapter/progress/types'
import { resumeSnapshot, validateSnapshot } from '../creation-history/types'

let view: VueWrapper | undefined
const permissions = utils.permission.getUserPermissions()
afterEach(() => {
  view?.unmount()
  utils.permission.setUserPermissions(permissions ?? [])
  vi.restoreAllMocks()
})
async function setup() {
  const repository = createHaloRepository()
  utils.permission.setUserPermissions(['*'])
  let options!: GenerationOptions
  let resolve!: (document: LinguiDocument) => void
  let reject!: (cause: unknown) => void
  const generate = vi.spyOn(repository, 'generate').mockImplementation((_text, _doc, value) => {
    options = value!
    return new Promise((done, fail) => {
      resolve = done
      reject = fail
    })
  })
  view = mount(AiComposer, { global: { provide: { [repositoryKey as symbol]: repository } } })
  await view.get('textarea').setValue('做一个知识测验')
  await view.get('form').trigger('submit')
  return {
    generate,
    progress: (label: string) =>
      options.onProgress!({
        type: 'activity',
        id: 'model-0',
        label,
        state: 'running',
        elapsedMs: 10,
      }),
    resolve: (value: LinguiDocument) => resolve(value),
    reject: (cause: unknown) => reject(cause),
    signal: () => options.signal,
  }
}

describe('AI execution progress in conversation', () => {
  it('renders real steps while pending, expands them and retains them on completion', async () => {
    const task = await setup()
    task.progress('模型生成设计 · 第 1 轮')
    await flushPromises()
    expect(view!.get('[aria-label="AI 执行进度"]').text()).toContain('模型生成设计')
    expect(view!.text()).toContain('正在等待模型返回')
    await view!.get('.lu-generation-toggle').trigger('click')
    expect(view!.get('.lu-generation-toggle').attributes('aria-expanded')).toBe('true')
    task.resolve(examples[0]!.create())
    await flushPromises()
    expect(view!.emitted('generated')).toHaveLength(1)
    expect(view!.text()).toContain('生成完成')
    expect(view!.text()).toContain('组件结构校验通过')
    expect(view!.text()).toContain('交互自检完成')
    expect(view!.find('[aria-label="停止生成"]').exists()).toBe(false)
    const last = view!.emitted('conversation')!.at(-1)![0] as {
      messages: { progress?: GenerationTrace }[]
    }
    expect(last.messages.at(-1)?.progress?.outcome).toBe('done')
  })

  it('aborts on stop and never applies a result even if the repository delivers it late', async () => {
    const task = await setup()
    task.progress('模型生成设计')
    await view!.get('[aria-label="停止生成"]').trigger('click')
    expect(task.signal()?.aborted).toBe(true)
    task.resolve(examples[0]!.create())
    await flushPromises()
    expect(view!.emitted('generated')).toBeUndefined()
    expect(view!.text()).toContain('已停止生成')
    await view!.get('.lu-generation-toggle').trigger('click')
    expect(view!.find('.lu-generation-timeline').exists()).toBe(true)
    expect(view!.find('.is-running').exists()).toBe(false)
  })

  it('retains the failed stage and the existing provider diagnostic details', async () => {
    const task = await setup()
    task.progress('模型生成设计 · 第 2 轮')
    task.reject({
      response: {
        status: 502,
        data: {
          detail: '服务商认证失败',
          category: 'provider-http',
          reference: '12345678',
          providerStatus: 401,
        },
      },
    })
    await flushPromises()
    expect(view!.text()).toContain('生成未完成')
    await view!.get('.lu-generation-toggle').trigger('click')
    expect(view!.get('.lu-generation-timeline .is-error').text()).toContain('第 2 轮')
    expect(view!.get('.lu-chat-error-details').text()).toContain('12345678')
    expect(view!.text()).toContain('重试生成')
  })

  it('cancels when leaving the conversation and preserves progress in resumed history', async () => {
    const task = await setup()
    view!.unmount()
    view = undefined
    expect(task.signal()?.aborted).toBe(true)
    task.resolve(examples[0]!.create())
    await flushPromises()
    const snapshot = {
      messages: [
        {
          id: 1,
          role: 'assistant' as const,
          status: 'pending' as const,
          text: '',
          progress: {
            activities: [
              { id: 'model-0', label: '模型生成设计', state: 'running' as const, startedMs: 0 },
            ],
            elapsedMs: 1000,
            outcome: 'running' as const,
          },
        },
      ],
      instruction: '',
      dirty: false,
      editing: false,
    }
    const resumed = resumeSnapshot(snapshot)
    expect(resumed.messages[0]?.progress).toMatchObject({
      outcome: 'stopped',
      activities: [{ state: 'error' }],
    })
    expect(validateSnapshot(resumed)).toEqual(resumed)
  })
})
