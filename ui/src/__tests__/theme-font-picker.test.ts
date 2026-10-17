import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { FontFamilyDefinition } from '@lingui/renderer'
import ThemeFontPicker from '../theme-studio/ThemeFontPicker.vue'

const fonts: FontFamilyDefinition[] = Array.from({ length: 100 }, (_, index) => ({
  id: `font-${index}`,
  name: `我的字体 ${index}`,
  faces: [
    { url: `https://example.com/${index}.woff2`, format: 'woff2', weight: '400', style: 'normal' },
  ],
}))
let view: VueWrapper
function picker(customFont?: FontFamilyDefinition) {
  view = mount(ThemeFontPicker, {
    attachTo: document.body,
    props: {
      modelValue: 'system',
      customFont,
      fonts,
      'onUpdate:modelValue': (value) => view.setProps({ modelValue: value }),
      'onUpdate:customFont': (value) => view.setProps({ customFont: value }),
    },
    global: {
      stubs: {
        FontSpecimen: { props: ['font'], template: '<p class="specimen">{{ font.name }}</p>' },
      },
    },
  })
  return view
}
afterEach(() => {
  view?.unmount()
  document.body.replaceChildren()
})

describe('compact theme font selection', () => {
  it('keeps a large library collapsed and renders only the selected specimen', async () => {
    picker(fonts[99])
    expect(view.find('[role="listbox"]').exists()).toBe(false)
    expect(view.findAll('.specimen')).toHaveLength(1)
    await view.get('.lu-theme-font-trigger').trigger('click')
    expect(view.findAll('[role="option"]')).toHaveLength(103)
    expect(view.findAll('.specimen')).toHaveLength(1)
    await view.get('input[aria-label="搜索字体"]').setValue(' 我的字体 12 ')
    expect(view.findAll('[role="option"]')).toHaveLength(1)
    await view.get('[role="option"]').trigger('click')
    expect(view.find('[role="listbox"]').exists()).toBe(false)
    expect(view.get('.lu-theme-font-trigger').text()).toBe('我的字体 12')
    expect(view.get('.specimen').text()).toBe('我的字体 12')
    expect(document.activeElement).toBe(view.get('.lu-theme-font-trigger').element)
  })
  it('shows no results, clears the search and ignores Enter during composition', async () => {
    picker()
    await view.get('.lu-theme-font-trigger').trigger('click')
    const search = view.get('input[aria-label="搜索字体"]')
    await search.setValue('不存在的字体')
    expect(view.findAll('[role="option"]')).toHaveLength(0)
    expect(view.get('[role="status"]').text()).toBe('没有找到匹配的字体')
    await search.trigger('keydown', { key: 'Enter' })
    expect(view.get('.lu-theme-font-trigger').attributes('aria-expanded')).toBe('true')
    await view.get('button[aria-label="清空搜索字体"]').trigger('keydown', { key: 'Enter' })
    expect(view.get('.lu-theme-font-trigger').attributes('aria-expanded')).toBe('true')
    await view.get('button[aria-label="清空搜索字体"]').trigger('click')
    expect(document.activeElement).toBe(search.element)
    expect(view.findAll('[role="option"]')).toHaveLength(103)
    await search.setValue('等宽')
    await search.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(view.emitted('update:modelValue')).toBeUndefined()
    await search.trigger('keydown', { key: 'Enter' })
    expect(view.get('.lu-theme-font-trigger').text()).toBe('等宽')
  })
  it('navigates with the keyboard, closes with Escape and keeps the theme unchanged', async () => {
    picker()
    const trigger = view.get('.lu-theme-font-trigger')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(view.get('[data-font-key="builtin:system"]').element)
    await view.get('[data-font-key="builtin:system"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(view.get('[data-font-key="builtin:serif"]').element)
    await view.get('[data-font-key="builtin:serif"]').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(view.get('[data-font-key="custom:font-99"]').element)
    await view.get('[data-font-key="custom:font-99"]').trigger('keydown', { key: 'Escape' })
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
    expect(view.emitted('update:modelValue')).toBeUndefined()
    expect(view.emitted('update:customFont')).toBeUndefined()
  })
  it('keeps the saved snapshot when its library entry changes or is removed', async () => {
    const snapshot = { ...fonts[0]!, name: '保存时的字体' }
    picker(snapshot)
    await view.get('.lu-theme-font-trigger').trigger('click')
    const option = view.get('[data-font-key="custom:font-0"]')
    expect(option.attributes('aria-selected')).toBe('true')
    expect(option.text()).toContain(snapshot.name)
    await option.trigger('click')
    expect(view.emitted('update:customFont')!.at(-1)![0]).toEqual(snapshot)
    expect(view.emitted('update:customFont')!.at(-1)![0]).not.toBe(snapshot)
    await view.setProps({ fonts: [] })
    await view.get('.lu-theme-font-trigger').trigger('click')
    expect(view.findAll('[role="option"]')).toHaveLength(4)
    expect(view.get('[data-font-key="custom:font-0"]').text()).toContain(snapshot.name)
  })
  it('closes when focus leaves, and opens management without changing the selection', async () => {
    picker()
    const outside = document.createElement('button')
    document.body.append(outside)
    await view.get('.lu-theme-font-trigger').trigger('click')
    outside.focus()
    await view.vm.$nextTick()
    expect(view.get('.lu-theme-font-trigger').attributes('aria-expanded')).toBe('false')
    await view.get('.lu-theme-font-trigger').trigger('click')
    await view.get('.lu-theme-manage-fonts').trigger('click')
    expect(view.emitted('manage')).toHaveLength(1)
    expect(view.get('.lu-theme-font-trigger').attributes('aria-expanded')).toBe('false')
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })
})
