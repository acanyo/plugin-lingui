import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, examples } from '@lingui/renderer'
import LinguiProjectRender from '../project-rendering/LinguiProjectRender.vue'

const reference = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('@lingui/renderer', async (original) => ({
  ...(await original<typeof import('@lingui/renderer')>()),
  loadComponentReference: reference.load,
}))
let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.clearAllMocks()
})
const instance = () => createInstance(examples.find((example) => example.id === 'notice')!.create())
const globals = {
  stubs: {
    LinguiRenderer: {
      name: 'LinguiRenderer',
      props: ['instance', 'interactions', 'autoStart'],
      template: '<div data-rendered />',
    },
  },
}

describe('public Vue project rendering', () => {
  it('does not fetch an empty ID and constrains preview interactions', async () => {
    reference.load.mockResolvedValue(instance())
    view = mount(LinguiProjectRender, { props: { projectId: '', preview: true }, global: globals })
    expect(reference.load).not.toHaveBeenCalled()
    expect(view.text()).toContain('请选择')
    await view.setProps({ projectId: 'notice' })
    await flushPromises()
    const renderer = view.findComponent({ name: 'LinguiRenderer' })
    expect(renderer.props('autoStart')).toBe(false)
    expect(renderer.props('interactions')).toMatchObject({
      autoStart: false,
      inheritRegistered: false,
    })
    expect(
      renderer.props('interactions').requests.allow(new URL('https://example.com'), 'POST'),
    ).toBe(false)
    await view.setProps({ preview: false })
    expect(renderer.props('autoStart')).toBe(true)
    expect(renderer.props('interactions').requests).toBeUndefined()
  })

  it('cancels stale reads, keeps the newest instance and supports retry after missing references', async () => {
    let finishOld!: (value: ReturnType<typeof instance>) => void
    reference.load
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve
          }),
      )
      .mockResolvedValueOnce({ ...instance(), templateId: 'new-project' })
      .mockRejectedValueOnce(new Error('组件不存在或未开启公开嵌入'))
      .mockResolvedValueOnce({ ...instance(), templateId: 'restored' })
    view = mount(LinguiProjectRender, { props: { projectId: 'old-project' }, global: globals })
    const oldSignal = reference.load.mock.calls[0]![1] as AbortSignal
    await view.setProps({ projectId: 'new-project' })
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    finishOld({ ...instance(), templateId: 'old-project' })
    await flushPromises()
    expect(view.findComponent({ name: 'LinguiRenderer' }).props('instance').templateId).toBe(
      'new-project',
    )
    await view.setProps({ projectId: 'missing' })
    await flushPromises()
    expect(view.findComponent({ name: 'LinguiRenderer' }).exists()).toBe(false)
    expect(view.get('[role="alert"]').text()).toContain('未开启公开嵌入')
    await view.get('button').trigger('click')
    await flushPromises()
    expect(view.findComponent({ name: 'LinguiRenderer' }).props('instance').templateId).toBe(
      'restored',
    )
  })
})
