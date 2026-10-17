import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import { utils } from '@halo-dev/ui-shared'
import { createInstance, type ComponentInstance } from '@lingui/renderer'
import { column, document as design, text } from '../../../packages/renderer/src/examples/builders'
import { createHaloRepository } from '../services/halo-repository'
import { repositoryKey } from '../services/repository'
import StudioView from '../views/StudioView.vue'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'
import DesignCandidates from '../design-candidates/DesignCandidates.vue'
import InteractionRecordingPanel from '../interaction-recordings/InteractionRecordingPanel.vue'
let wrapper: VueWrapper | undefined
const permissions = utils.permission.getUserPermissions()
const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  utils.permission.setUserPermissions(permissions ?? [])
  document.body.replaceChildren()
})
async function setup(instance: ComponentInstance) {
  const repository = createHaloRepository()
  vi.spyOn(repository, 'listTemplates').mockResolvedValue([])
  vi.spyOn(repository, 'listThemes').mockResolvedValue([])
  const generate = vi.spyOn(repository, 'generate'),
    save = vi.spyOn(repository, 'saveTemplate')
  utils.permission.setUserPermissions(['*'])
  wrapper = mount(StudioView, {
    attachTo: document.body,
    props: { initialInstance: instance },
    global: {
      provide: { [repositoryKey as symbol]: repository },
      plugins: [[formkit, defaultConfig()]],
      stubs: { transition: false },
    },
  })
  await settle()
  return { generate, save }
}
async function press(label: string) {
  const button = wrapper!.findAll('button').find((row) => row.text().trim() === label)
  expect(button, `button ${label}`).toBeTruthy()
  await button!.trigger('click')
  await settle()
}
const active = () => wrapper!.getComponent(CreationWorkspace).props('instance') as ComponentInstance
const card = (title: string) => design(title, [column('root', ['label']), text('label', title)])
describe('creative feature workbench integration', () => {
  it('captures real shadow-root input/click events after resetting the preview and preserves the editable instance', async () => {
    const instance = createInstance(
      design(
        '答题',
        [
          column('root', ['input', 'show']),
          { id: 'input', component: 'TextField', label: '答案', value: { path: '/answer' } },
          {
            id: 'show',
            component: 'Button',
            child: 'label',
            action: {
              functionCall: {
                call: 'lingui.dispatch',
                args: { actions: [{ type: 'setState', path: '/shown', value: true }] },
              },
            },
          },
          text('label', '查看解析'),
        ],
        { answer: '', shown: false },
      ),
    )
    const before = JSON.stringify(instance)
    const { save } = await setup(instance)
    await press('开始录制')
    const shadow = wrapper!.get('.lu-artifact-canvas .lingui-renderer-host').element.shadowRoot!
    const input = shadow.querySelector<HTMLInputElement>('input')!
    input.value = 'B'
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    await settle()
    shadow.querySelector<HTMLButtonElement>('[data-lingui-node="show"]')!.click()
    await settle()
    await press('结束并保存 3 步')
    const records = wrapper!.getComponent(InteractionRecordingPanel).props('controller')
      .records.value
    expect(records).toHaveLength(1)
    expect(records[0]!.steps.map((step: { event: string }) => step.event)).toEqual([
      'change',
      'input',
      'click',
    ])
    expect(records[0]!.steps[0]!.data).toMatchObject({ value: 'B' })
    expect(wrapper!.getComponent(CreationWorkspace).props('initialRecordings')).toHaveLength(1)
    expect(JSON.stringify(active())).toBe(before)
    expect(save).not.toHaveBeenCalled()
  })
  it('previews independent candidates, adopts with undo, preserves alternatives and asks about edits made during generation', async () => {
    const instance = createInstance(card('原作'))
    const { generate, save } = await setup(instance)
    generate.mockResolvedValueOnce(card('紧凑方案')).mockResolvedValueOnce(card('舒展方案'))
    const candidates = wrapper!.getComponent(DesignCandidates)
    await candidates.get('textarea').setValue('生成两个布局')
    await press('生成两种方案')
    await settle()
    expect(generate).toHaveBeenCalledTimes(2)
    expect(active().document.title).toBe('原作')
    const adopt = candidates
      .findAll('button')
      .filter((button) => button.text() === '采用此案（可撤销）')
    expect(adopt).toHaveLength(2)
    await adopt[0]!.trigger('click')
    await settle()
    expect(active().document.title).toBe('紧凑方案')
    expect(candidates.findAll('.lu-candidate-preview')).toHaveLength(2)
    await wrapper!.get('button[aria-label="撤销修改"]').trigger('click')
    await settle()
    expect(active().document.title).toBe('原作')
    await wrapper!.get('input[aria-label="组件名称"]').setValue('手动标题')
    await wrapper!.get('input[aria-label="组件名称"]').trigger('change')
    await settle()
    await adopt[1]!.trigger('click')
    await settle()
    expect(active().document.title).toBe('手动标题')
    expect(wrapper!.find('.lu-ai-conflict').exists()).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })
})
