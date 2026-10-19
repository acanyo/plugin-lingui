import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { defaultConfig, FormKit, plugin, useFormKitNodeById } from '@formkit/vue'
import { axiosInstance } from '@halo-dev/api-client'
import type { ProjectOption, ProjectOptionList } from '../api/project-selection'
import { LinguiProjectSelect, linguiProjectSelect } from '../project-selection'
import {
  projectSelectionClientKey,
  createProjectSelectionClient,
  type ProjectSelectionClient,
} from '../project-selection/client'

vi.mock('../project-rendering/LinguiProjectRender.vue', () => ({
  default: defineComponent({ props: ['projectId', 'preview'], template: '<div data-preview />' }),
}))

const SearchInput = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input type="search" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)" @keyup.enter="$emit(\'update:modelValue\', $event.target.value)" />',
})
const VButton = defineComponent({
  props: ['disabled', 'size'],
  emits: ['click'],
  template:
    '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})
let views: VueWrapper[] = []
afterEach(() => {
  views.forEach((view) => view.unmount())
  views = []
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function option(id: string, displayName = id, embedEnabled = true): ProjectOption {
  return { id, displayName, embedEnabled, category: '内容', description: '可复用组件', revision: 2 }
}
function page(items = [option('first')], total = items.length): ProjectOptionList {
  return { items, total, page: 1, size: 20 }
}
function client(overrides: Partial<ProjectSelectionClient> = {}): ProjectSelectionClient {
  return {
    list: vi.fn().mockResolvedValue(page()),
    get: vi.fn(async (id: string) => option(id, `已选 ${id}`)),
    ...overrides,
  }
}
function setup(
  api = client(),
  props: Partial<InstanceType<typeof LinguiProjectSelect>['$props']> = {},
) {
  const view = mount(LinguiProjectSelect, {
    props,
    attachTo: document.body,
    global: {
      plugins: [[plugin, defaultConfig()]],
      components: { SearchInput },
      stubs: { VButton },
      provide: { [projectSelectionClientKey as symbol]: api },
    },
  })
  views.push(view)
  return { view, api }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}
function button(view: VueWrapper, label: string) {
  return view.findAll('button').find((item) => item.text().trim() === label)!
}

describe('public project selector integration', () => {
  it('uses the generated read-only console API and propagates cancellation', async () => {
    const request = vi
      .spyOn(axiosInstance, 'request')
      .mockResolvedValueOnce({ data: page([option('saved')]) })
      .mockResolvedValueOnce({ data: option('saved') })
    const api = createProjectSelectionClient()
    const controller = new AbortController()
    expect(
      await api.list({ page: 2, size: 20, keyword: 'notice', publicOnly: true }, controller.signal),
    ).toEqual(page([option('saved')]))
    expect(await api.get('saved', true, controller.signal)).toEqual(option('saved'))
    expect(request).toHaveBeenCalledTimes(2)
    for (const [config] of request.mock.calls) {
      expect(config).toMatchObject({ method: 'GET', signal: controller.signal, timeout: 15000 })
      expect(config.url).toContain('/apis/console.api.lingui.acanyo.com/v1alpha1/projectoptions')
    }
    expect(request.mock.calls[0]![0].url).toContain('publicOnly=true')
    expect(request.mock.calls[1]![0].url).toContain('/saved?publicOnly=true')
  })

  it('submits only the project ID through the real FormKit custom input', async () => {
    const submit = vi.fn()
    const api = client({
      list: vi.fn().mockResolvedValue(page([option('first'), option('second')])),
    })
    const form = defineComponent({
      setup: () => () =>
        h(
          FormKit,
          { type: 'form', actions: false, onSubmit: submit },
          {
            default: () =>
              h(FormKit, {
                type: 'linguiProjectSelect',
                name: 'componentId',
                id: 'component-field',
                label: '选择作品',
                delay: 0,
              }),
          },
        ),
    })
    const view = mount(form, {
      attachTo: document.body,
      global: {
        plugins: [[plugin, defaultConfig({ inputs: { linguiProjectSelect } })]],
        components: { SearchInput },
        stubs: { VButton },
        provide: { [projectSelectionClientKey as symbol]: api },
      },
    })
    views.push(view)
    await flushPromises()
    expect(useFormKitNodeById('component-field').value?.name).toBe('componentId')
    expect(view.get('label').attributes('for')).toBe(view.get('select').attributes('id'))
    const searchInput = view.get<HTMLInputElement>('input[type="search"]')
    searchInput.element.value = '通知'
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    searchInput.element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    await searchInput.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(submit).not.toHaveBeenCalled()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '通知' }),
      expect.any(AbortSignal),
    )
    await view.get('select').setValue('second')
    expect(useFormKitNodeById('component-field').value?._value).toBe('second')
    // Submit before the inner select's zero-delay commit; the outer form must wait.
    await view.get('form').trigger('submit')
    await useFormKitNodeById('component-field').value?.settled
    await flushPromises()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0]![0]).toEqual({ componentId: 'second' })
    expect(api.list).toHaveBeenCalledWith(
      { page: 1, size: 20, keyword: undefined, category: undefined, publicOnly: true },
      expect.any(AbortSignal),
    )
  })

  it('rehydrates an ID outside the current page without changing its value', async () => {
    const { view, api } = setup(client(), { modelValue: 'off-page' })
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('off-page', true, expect.any(AbortSignal))
    expect(view.get<HTMLSelectElement>('select').element.value).toBe('off-page')
    expect(view.get('option[value="off-page"]').text()).toBe('已选 off-page')
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })

  it('clears explicitly and respects disabled and clearable props', async () => {
    const { view } = setup(client(), { modelValue: 'off-page' })
    await flushPromises()
    await button(view, '清空').trigger('click')
    expect(view.emitted('update:modelValue')).toEqual([['']])
    await view.setProps({ disabled: true })
    expect(view.get<HTMLSelectElement>('select').element.disabled).toBe(true)
    expect(button(view, '清空').attributes('disabled')).toBeDefined()
    await view.get('select').setValue('first')
    await button(view, '清空').trigger('click')
    expect(view.emitted('update:modelValue')).toEqual([['']])
    await view.setProps({ disabled: false, clearable: false })
    expect(button(view, '清空')).toBeUndefined()
    expect(view.get('option[value=""]').attributes('disabled')).toBeDefined()
    await view.get('select').setValue('')
    expect(view.emitted('update:modelValue')).toEqual([['']])
  })

  it('requests pages and resets pagination for search and category changes', async () => {
    const api = client({ list: vi.fn().mockResolvedValue(page([option('first')], 41)) })
    const { view } = setup(api, { category: '内容' })
    await flushPromises()
    await view.get('.pagination__btn--next').trigger('click')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, category: '内容' }),
      expect.any(AbortSignal),
    )
    await view.get('input[type="search"]').setValue('通知')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, keyword: '通知', category: '内容' }),
      expect.any(AbortSignal),
    )
    await view.setProps({ category: '表单' })
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, keyword: '通知', category: '表单' }),
      expect.any(AbortSignal),
    )
  })

  it('ignores old search results even when the transport resolves after cancellation', async () => {
    const old = deferred<ProjectOptionList>()
    const current = deferred<ProjectOptionList>()
    const list = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const { view } = setup(client({ list }))
    await view.get('input[type="search"]').setValue('新查询')
    await flushPromises()
    expect(list.mock.calls[0]![1].aborted).toBe(true)
    current.resolve(page([option('new', '新作品')]))
    await flushPromises()
    old.resolve(page([option('old', '旧作品')]))
    await flushPromises()
    expect(view.find('option[value="new"]').exists()).toBe(true)
    expect(view.find('option[value="old"]').exists()).toBe(false)
  })

  it('ignores a late selected response after the parent changes the ID', async () => {
    const old = deferred<ProjectOption>()
    const get = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(option('second', '第二件'))
    const { view } = setup(client({ get }), { modelValue: 'first' })
    await view.setProps({ modelValue: 'second' })
    await flushPromises()
    old.resolve(option('first', '第一件'))
    await flushPromises()
    expect(view.get<HTMLSelectElement>('select').element.value).toBe('second')
    expect(view.get('option[value="second"]').text()).toBe('第二件')
    expect(get.mock.calls[0]![2].aborted).toBe(true)
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })

  it('retains missing references and retries metadata and list failures', async () => {
    const api = client({
      list: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(page([])),
      get: vi.fn().mockRejectedValueOnce({ response: { status: 404 } }),
    })
    const { view } = setup(api, { modelValue: 'removed' })
    await flushPromises()
    expect(view.text()).toContain('已保留原项目 ID')
    expect(view.get<HTMLSelectElement>('select').element.value).toBe('removed')
    expect(view.get('option[value="removed"]').attributes('disabled')).toBeDefined()
    expect(view.emitted('update:modelValue')).toBeUndefined()
    await button(view, '重试加载作品').trigger('click')
    await flushPromises()
    expect(view.text()).toContain('还没有开启公开嵌入的作品')
    await view.setProps({ modelValue: 'recoverable' })
    await flushPromises()
    expect(view.text()).not.toContain('已保留原项目 ID')
    expect(view.text()).toContain('无法读取所选作品')
    vi.mocked(api.get).mockResolvedValueOnce(option('recoverable', '恢复的作品'))
    await button(view, '重试读取所选作品').trigger('click')
    await flushPromises()
    expect(view.get('option[value="recoverable"]').text()).toBe('恢复的作品')
  })

  it('shows private metadata only when requested and never previews private works', async () => {
    const privateWork = option('private', '私有作品', false)
    const api = client({
      list: vi.fn().mockResolvedValue(page([privateWork])),
      get: vi.fn().mockResolvedValue(privateWork),
    })
    const { view } = setup(api, { modelValue: 'private', publicOnly: false, showPreview: true })
    await flushPromises()
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ publicOnly: false }),
      expect.any(AbortSignal),
    )
    expect(view.get('option[value="private"]').text()).toContain('未公开')
    expect(view.text()).toContain('公开页面暂时无法展示')
    expect(view.find('[data-preview]').exists()).toBe(false)
    expect(Object.keys(api)).toEqual(['list', 'get'])
    await view.setProps({ publicOnly: true })
    await flushPromises()
    expect(view.text()).toContain('已保留原项目 ID')
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })

  it('clamps requested page size and previews only an explicitly public selection', async () => {
    const { view, api } = setup(client(), { modelValue: 'first', pageSize: 500, showPreview: true })
    await flushPromises()
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ size: 100 }),
      expect.any(AbortSignal),
    )
    expect(view.find('[data-preview]').exists()).toBe(true)
  })
})
