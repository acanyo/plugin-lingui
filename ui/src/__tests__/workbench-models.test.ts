import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { examples, pureTheme, type LinguiDocument } from '@lingui/renderer'
import StudioView from '../views/StudioView.vue'
import StudioNavigation from '../workspace/StudioNavigation.vue'
import AiComposer from '../ai-adapter/AiComposer.vue'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import { modelPreferenceKey } from '../model-selection/useModelSelection'

vi.mock('../creation-history/history-scope', async () => {
  const { computed } = await import('vue')
  return { useHistoryScope: () => computed(() => 'halo:alice') }
})

const Selector = defineComponent({
  name: 'FormKit',
  props: {
    type: String,
    label: String,
    modelValue: String,
    modelType: String,
    available: Boolean,
    requiredFeatures: Array,
    clearable: Boolean,
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'select',
        {
          'aria-label': props.label,
          value: props.modelValue ?? '',
          disabled: props.disabled,
          onChange: (event: Event) =>
            emit('update:modelValue', (event.target as HTMLSelectElement).value || undefined),
        },
        ['', 'legacy-model', 'chosen-model'].map((value) =>
          h('option', { value }, value || '默认模型'),
        ),
      )
  },
})
let view: VueWrapper | undefined
const permissions = utils.permission.getUserPermissions()
beforeEach(() => localStorage.clear())
afterEach(() => {
  view?.unmount()
  view = undefined
  localStorage.clear()
  sessionStorage.clear()
  utils.permission.setUserPermissions(permissions ?? [])
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function setup(
  loadDefault = vi.fn().mockResolvedValue({ modelName: 'legacy-model' }),
  generate = vi.fn().mockResolvedValue(examples[0]!.create()),
  mode: 'halo' | 'local' = 'halo',
  granted = ['*'],
) {
  utils.permission.setUserPermissions(granted)
  const generateTheme = vi.fn().mockResolvedValue(pureTheme)
  const repository = {
    ...createLocalRepository(),
    mode,
    getGenerationSettings: loadDefault,
    listFonts: async () => [],
    generate,
    generateTheme,
  }
  view = mount(StudioView, {
    attachTo: document.body,
    global: {
      provide: { [repositoryKey as symbol]: repository },
      stubs: { FormKit: Selector },
    },
  })
  return { loadDefault, generate, generateTheme }
}
async function navigate(section: 'themes' | 'components') {
  view!.getComponent(StudioNavigation).vm.$emit('navigate', section)
  await flushPromises()
}
async function send(text = '创建一个信息卡') {
  await view!.get('textarea[aria-label="组件创作需求"]').setValue(text)
  await view!.get('.lu-prompt-box').trigger('submit')
  await flushPromises()
}
function composerSelector() {
  return view!.get<HTMLSelectElement>('.lu-ai-actions .lu-generation-model select')
}

describe('shared workbench model selection', () => {
  it('waits for legacy initialization and shares edits across component, theme, repair and candidate generation', async () => {
    const settings = deferred<{ modelName: string }>()
    const component = deferred<LinguiDocument>()
    const generate = vi
      .fn()
      .mockReturnValueOnce(component.promise)
      .mockImplementation(async () => examples[0]!.create())
    const api = setup(vi.fn().mockReturnValue(settings.promise), generate)
    await flushPromises()
    expect(composerSelector().attributes('disabled')).toBeDefined()
    await send()
    expect(api.generate).not.toHaveBeenCalled()
    settings.resolve({ modelName: 'legacy-model' })
    await flushPromises()
    expect(composerSelector().element.value).toBe('legacy-model')
    const control = view!.getComponent(Selector)
    expect(control.props()).toMatchObject({
      type: 'aiModelSelector',
      label: undefined,
      modelType: 'language',
      available: true,
      requiredFeatures: ['tool-call'],
      clearable: true,
    })
    expect(control.attributes('help')).toBeUndefined()
    expect(view!.find('.lu-chat-compose > .lu-generation-model').exists()).toBe(false)
    expect(
      view!.get('.lu-prompt-box .lu-ai-actions > .lu-generation-model').attributes(),
    ).toMatchObject({
      role: 'group',
      'aria-label': '生成模型',
    })
    expect(view!.get('textarea[aria-label="组件创作需求"]').attributes('rows')).toBe('2')
    await composerSelector().setValue('chosen-model')
    await send()
    expect(api.generate).toHaveBeenLastCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({
        modelName: 'chosen-model',
        onProgress: expect.any(Function),
        signal: expect.any(AbortSignal),
      }),
    )
    expect(composerSelector().attributes('disabled')).toBeDefined()
    await navigate('themes')
    const themeSelector = view!.get<HTMLSelectElement>(
      '.lu-theme-ai-actions .lu-generation-model select',
    )
    expect(view!.find('.lu-theme-ai form > .lu-generation-model').exists()).toBe(false)
    expect(themeSelector.element.value).toBe('chosen-model')
    expect(themeSelector.attributes('disabled')).toBeDefined()
    component.resolve(examples[0]!.create())
    await flushPromises()
    expect(themeSelector.attributes('disabled')).toBeUndefined()
    await themeSelector.setValue('')
    await view!.get('textarea[name="theme-instruction"]').setValue('调整圆角')
    await view!.get('.lu-theme-ai form').trigger('submit')
    await flushPromises()
    expect(api.generateTheme).toHaveBeenLastCalledWith('调整圆角', pureTheme, { modelName: '' })
    await navigate('components')
    expect(composerSelector().element.value).toBe('')
    await view!.getComponent(AiComposer).vm.repair('修复现有交互')
    await flushPromises()
    expect(api.generate).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ modelName: '' }),
    )
    await view!
      .findAll('button')
      .find((button) => button.text().trim() === '多方案')!
      .trigger('click')
    await send('做两个信息卡布局')
    expect(api.generate.mock.calls.length).toBeGreaterThanOrEqual(4)
    for (const call of api.generate.mock.calls.slice(1))
      expect(call[2]).toMatchObject({ modelName: '' })
    expect(JSON.parse(localStorage.getItem(modelPreferenceKey('halo:alice'))!)).toBe('')
    expect(api.loadDefault).toHaveBeenCalledTimes(1)
  })
  it('restores the same account preference after remount without fetching the plugin setting again', async () => {
    const first = setup()
    await flushPromises()
    await composerSelector().setValue('chosen-model')
    view!.unmount()
    const second = setup()
    await flushPromises()
    expect(second.loadDefault).not.toHaveBeenCalled()
    expect(composerSelector().element.value).toBe('chosen-model')
    expect(first.loadDefault).toHaveBeenCalledTimes(1)
  })
  it('keeps the selector usable after settings fail and permits explicit selection or retry', async () => {
    const loadDefault = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ modelName: 'legacy-model' })
    const api = setup(loadDefault)
    await flushPromises()
    expect(view!.text()).toContain('未能载入原模型设置')
    expect(view!.get('.lu-model-notice').attributes('open')).toBeUndefined()
    await view!.get('summary[aria-label="查看模型设置提示"]').trigger('click')
    await view!
      .findAll('button')
      .find((button) => button.text() === '重试载入')!
      .trigger('click')
    await flushPromises()
    expect(composerSelector().element.value).toBe('legacy-model')
    await composerSelector().setValue('chosen-model')
    await send()
    expect(api.generate).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ modelName: 'chosen-model' }),
    )
  })
  it.each([
    ['local', ['*']],
    ['halo', ['plugin:plugin-lingui:library:view']],
  ] as const)(
    'does not show a selector or load settings without direct AI access: %s',
    async (mode, grants) => {
      const api = setup(undefined, undefined, mode, [...grants])
      await flushPromises()
      expect(view!.find('.lu-generation-model').exists()).toBe(false)
      expect(api.loadDefault).not.toHaveBeenCalled()
      await navigate('themes')
      expect(view!.find('.lu-generation-model').exists()).toBe(false)
    },
  )
})
