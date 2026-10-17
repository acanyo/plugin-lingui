import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  accentForeground,
  autoDarkColors,
  autoLightColors,
  builtInThemes,
  contrastRatio,
  pureTheme,
  tokenStyle,
  validateDocument,
  type ThemeTokens,
} from '@lingui/renderer'
import ThemeStudio from '../theme-studio/ThemeStudio.vue'
import ThemeColorField from '../theme-studio/ThemeColorField.vue'
import { themeControlsDocument } from '../theme-studio/preview-document'
import { normalizeHex } from '../theme-studio/theme-fields'
import { repositoryKey } from '../services/repository'
import { createLocalRepository } from '../dev/local-repository'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.replaceChildren()
})
function studio(themes = builtInThemes) {
  wrapper = mount(ThemeStudio, {
    attachTo: document.body,
    props: { themes },
    global: {
      provide: {
        [repositoryKey as symbol]: { ...createLocalRepository(), listFonts: async () => [] },
      },
    },
  })
  return wrapper
}
function button(text: string) {
  return wrapper!.findAll('button').find((item) => item.text() === text)!
}
function surface() {
  return wrapper!
    .get('.lingui-renderer-host')
    .element.shadowRoot!.querySelector<HTMLElement>('.lingui-surface')!
}

describe('theme palettes and author overrides', () => {
  it.each(builtInThemes.map((theme) => [theme.id, theme] as const))(
    '%s has readable preset text on both surfaces',
    (_id, theme) => {
      for (const background of [theme.colors.background, theme.colors.surface]) {
        expect(contrastRatio(theme.colors.text, background)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(theme.colors.muted, background)).toBeGreaterThanOrEqual(4.5)
      }
      expect(
        contrastRatio(theme.colors.accent, accentForeground(theme.colors.accent)),
      ).toBeGreaterThanOrEqual(4.5)
    },
  )
  it('derives auto dark colors from the author palette and retains already dark palettes', () => {
    const green = { ...pureTheme.colors, accent: '#16753f' },
      purple = { ...pureTheme.colors, accent: '#742fc0' }
    const darkGreen = autoDarkColors(green),
      darkPurple = autoDarkColors(purple)
    expect(darkGreen.accent).not.toBe(darkPurple.accent)
    const channels = [1, 3, 5].map((start) =>
      parseInt(darkGreen.accent.slice(start, start + 2), 16),
    )
    expect(channels[1]).toBeGreaterThan(channels[0]!)
    expect(channels[1]).toBeGreaterThan(channels[2]!)
    for (const theme of builtInThemes.filter((theme) => theme.mode === 'light')) {
      const dark = autoDarkColors(theme.colors)
      for (const background of [dark.background, dark.surface]) {
        expect(contrastRatio(dark.text, background)).toBeGreaterThanOrEqual(12)
        expect(contrastRatio(dark.muted, background)).toBeGreaterThanOrEqual(5)
        for (const color of [dark.accent, dark.success, dark.danger])
          expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5)
      }
    }
    const graphite = builtInThemes.find((theme) => theme.id === 'graphite')!
    expect(autoDarkColors(graphite.colors)).toEqual(graphite.colors)
    expect(green.accent).toBe('#16753f')
  })
  it('preserves explicit custom tokens and does not mutate stored snapshots', () => {
    const theme: ThemeTokens = {
      ...pureTheme,
      radius: 0,
      font: 'mono',
      colors: { ...pureTheme.colors, accent: '#facc15', surface: '#ecfdf5' },
    }
    const before = JSON.stringify(theme),
      style = tokenStyle(theme)
    expect(style['--lingui-radius']).toBe('0px')
    expect(style['--lingui-surface']).toBe('#ecfdf5')
    expect(style['--lingui-accent']).toBe('#facc15')
    expect(style['--lingui-on-accent']).toBe('#000000')
    expect(style['--lingui-font']).toContain('monospace')
    expect(tokenStyle({ ...theme, mode: 'auto' })['--lingui-auto-accent']).toBe(
      autoDarkColors(theme.colors).accent,
    )
    expect(JSON.stringify(theme)).toBe(before)
  })
  it('derives an accessible light companion when auto starts from a dark preset', () => {
    for (const theme of builtInThemes.filter((theme) => theme.mode === 'dark')) {
      const light = autoLightColors(theme.colors)
      expect(light.background).not.toBe(theme.colors.background)
      for (const background of [light.background, light.surface]) {
        expect(contrastRatio(light.text, background)).toBeGreaterThanOrEqual(12)
        expect(contrastRatio(light.muted, background)).toBeGreaterThanOrEqual(5)
        expect(contrastRatio(light.accent, background)).toBeGreaterThanOrEqual(4.5)
      }
      expect(tokenStyle({ ...theme, mode: 'auto' })['--lingui-text']).toContain(light.text)
    }
    expect(autoLightColors(pureTheme.colors)).toEqual(pureTheme.colors)
  })
  it('accepts shorthand hex without allowing CSS or incomplete values', () => {
    expect(normalizeHex(' #AbC ')).toBe('#aabbcc')
    expect(normalizeHex('#A1B2C3')).toBe('#a1b2c3')
    for (const value of ['#', '#12345', '#ffffff00', 'red', 'url(x)'])
      expect(normalizeHex(value)).toBeUndefined()
  })
  it('validates the transient controls specimen', () => {
    expect(() => validateDocument(themeControlsDocument())).not.toThrow()
  })
})

describe('theme studio editing and preview', () => {
  it('switches all font specimens without losing live preview state', async () => {
    const view = studio()
    await flushPromises()
    const input = surface().querySelector<HTMLInputElement>('.lg-input-shell input')!
    input.value = '保留字体预览内容'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    for (const [font, label] of [
      ['serif', '衬线 / 宋体'],
      ['mono', '等宽'],
      ['system', '系统无衬线'],
    ] as const) {
      await view.get('.lu-theme-font-trigger').trigger('click')
      await view.get(`[data-font-key="builtin:${font}"]`).trigger('click')
      await flushPromises()
      expect(surface().style.getPropertyValue('--lingui-font')).toBe(
        tokenStyle({ ...pureTheme, font })['--lingui-font'],
      )
      expect(surface().querySelector<HTMLInputElement>('.lg-input-shell input')!.value).toBe(
        '保留字体预览内容',
      )
      expect(view.get('.lu-theme-font-trigger').attributes('aria-label')).toBe(
        `选择字体，当前：${label}`,
      )
    }
    expect(view.emitted('save')).toBeUndefined()
  })
  it('keeps live input and last valid style while a color is incomplete, then restores the draft', async () => {
    const view = studio()
    await flushPromises()
    const input = surface().querySelector<HTMLInputElement>('.lg-input-shell input')!
    input.value = '保留预览交互'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await view.get('input[aria-label="强调色色值"]').setValue('#12')
    expect(view.get('input[aria-label="强调色色值"]').attributes('aria-invalid')).toBe('true')
    expect(button('保存为我的主题').attributes('disabled')).toBeDefined()
    expect(surface().style.getPropertyValue('--lingui-accent')).toBe(pureTheme.colors.accent)
    expect(input.value).toBe('保留预览交互')
    await view.get('input[aria-label="强调色色值"]').setValue('#0a8')
    await view.get('input[aria-label="强调色色值"]').trigger('blur')
    await flushPromises()
    expect(surface().style.getPropertyValue('--lingui-accent')).toBe('#00aa88')
    expect(surface().querySelector<HTMLInputElement>('.lg-input-shell input')!.value).toBe(
      '保留预览交互',
    )
    expect(button('保存为我的主题').attributes('disabled')).toBeUndefined()
    await button('还原修改').trigger('click')
    await flushPromises()
    expect(view.get('input[aria-label="强调色色值"]').element).toHaveProperty(
      'value',
      pureTheme.colors.accent,
    )
    expect(surface().querySelector<HTMLInputElement>('.lg-input-shell input')!.value).toBe(
      '保留预览交互',
    )
    expect(view.emitted('save')).toBeUndefined()
  })
  it('does not expand shorthand while the author is still typing a six-digit hex color', async () => {
    wrapper = mount(ThemeColorField, {
      props: {
        modelValue: '#2563eb',
        label: '强调色',
        'onUpdate:modelValue': (value) => {
          void wrapper!.setProps({ modelValue: value })
        },
      },
    })
    const input = wrapper.get('input[aria-label="强调色色值"]')
    for (const value of ['#', '#1', '#12', '#123', '#1234', '#12345']) {
      await input.setValue(value)
      expect(input.element).toHaveProperty('value', value)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    }
    await input.setValue('#123456')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBe('#123456')
    await input.setValue('#abc')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBe('#aabbcc')
  })
  it('retains the last valid preview for an empty name and does not export invalid data', async () => {
    const view = studio()
    await flushPromises()
    await view.get('input[maxlength="120"]').setValue('')
    await flushPromises()
    expect(surface()).toBeDefined()
    expect(view.text()).toContain('上一次有效样式')
    expect(button('导出主题').attributes('disabled')).toBeDefined()
  })
  it('does not mark a save complete until the repository acknowledges it', async () => {
    const view = studio()
    await view.get('input[maxlength="120"]').setValue('新的主题')
    await button('保存为我的主题').trigger('click')
    const saved = view.emitted('save')![0]![0] as ThemeTokens
    expect(saved.id).not.toBe('pure')
    expect(view.text()).toContain('未保存')
    await view.setProps({ themes: [...builtInThemes, saved] })
    expect(view.find('.lu-theme-draft').exists()).toBe(false)
    await view.get('input[aria-label="强调色色值"]').setValue('#ffffff')
    await flushPromises()
    expect(view.text()).toContain('建议调整配色')
    // Low contrast remains an advisory; author colors can still be saved.
    expect(button('保存主题').attributes('disabled')).toBeUndefined()
    await button('还原修改').trigger('click')
    expect(view.get('input[maxlength="120"]').element).toHaveProperty('value', '新的主题')
    expect(pureTheme.name).not.toBe('新的主题')
  })
  it('filters presets and restores a built-in after a custom theme is removed', async () => {
    const custom: ThemeTokens = { ...pureTheme, id: 'mine', name: '我的自定义' }
    const view = studio([...builtInThemes, custom])
    await button('深色').trigger('click')
    expect(view.findAll('.lu-theme-swatch')).toHaveLength(2)
    await button('我的主题').trigger('click')
    await view.get('.lu-theme-swatch').trigger('click')
    await button('删除此主题').trigger('click')
    expect(view.emitted('delete')![0]![0]).toEqual(custom)
    await view.setProps({ themes: builtInThemes })
    expect(view.get('input[maxlength="120"]').element).toHaveProperty('value', pureTheme.name)
  })
  it('previews auto light/dark without changing the authored theme or resetting interactions', async () => {
    const view = studio()
    await flushPromises()
    const input = surface().querySelector<HTMLInputElement>('.lg-input-shell input')!
    input.value = '自动主题交互'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await view.get('select').setValue('auto')
    await flushPromises()
    await button('深色效果').trigger('click')
    await flushPromises()
    expect(surface().dataset.mode).toBe('dark')
    expect(surface().style.getPropertyValue('--lingui-accent')).toBe(
      autoDarkColors(pureTheme.colors).accent,
    )
    expect(surface().querySelector<HTMLInputElement>('.lg-input-shell input')!.value).toBe(
      '自动主题交互',
    )
    expect(view.get('select').element).toHaveProperty('value', 'auto')
    expect(view.get('input[aria-label="强调色色值"]').element).toHaveProperty(
      'value',
      pureTheme.colors.accent,
    )
    await button('重置交互').trigger('click')
    await flushPromises()
    expect(surface().querySelector<HTMLInputElement>('.lg-input-shell input')!.value).toBe(
      '我的交互作品',
    )
  })
  it('keeps imported JSON isolated and disables actions for invalid imports', async () => {
    const view = studio()
    await view
      .get('textarea[aria-label="主题 JSON"]')
      .setValue(JSON.stringify({ ...pureTheme, name: '导入样式', radius: 0 }))
    await button('校验并预览').trigger('click')
    await flushPromises()
    expect(view.get('input[maxlength="120"]').element).toHaveProperty('value', '导入样式')
    expect(surface().style.getPropertyValue('--lingui-radius')).toBe('0px')
    expect(view.emitted('save')).toBeUndefined()
    await view.get('input[maxlength="120"]').setValue('导入后修改')
    await button('还原修改').trigger('click')
    expect(view.get('input[maxlength="120"]').element).toHaveProperty('value', '导入样式')
    expect(view.find('.lu-theme-draft').exists()).toBe(true)
    expect(button('保存为我的主题').exists()).toBe(true)
    await view.get('textarea[aria-label="主题 JSON"]').setValue('{"__proto__":{}}')
    await button('校验并预览').trigger('click')
    await flushPromises()
    expect(view.text()).toContain('不安全')
    expect(surface().style.getPropertyValue('--lingui-radius')).toBe('0px')
  })
})
