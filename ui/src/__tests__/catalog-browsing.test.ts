import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  CATALOG_ID,
  componentNames,
  resolveDocument,
  mountRenderer,
  type RendererHandle,
} from '@lingui/renderer'
import CatalogView from '../component-studio/CatalogView.vue'
import { componentGroups } from '../component-studio/catalog-labels'
import { createCatalogPreview } from '../component-studio/catalog-preview'
import { renderedElement } from './rendered-dom'

let view: VueWrapper | undefined
let handle: RendererHandle | undefined
afterEach(async () => {
  view?.unmount()
  view = undefined
  await handle?.destroy()
  handle = undefined
  document.body.replaceChildren()
})
describe('basic component browsing', () => {
  it('includes every supported kind exactly once in the browsing groups', () => {
    const names = componentGroups.flatMap((group) => group.names)
    expect([...names].sort()).toEqual([...componentNames].sort())
    expect(new Set(names).size).toBe(names.length)
  })
  it.each(componentNames)('renders a valid interactive preview for %s', async (kind) => {
    const instance = createCatalogPreview(kind)
    expect(instance.document.schemaVersion).toBe('lingui.document/2')
    expect(instance.document.source).toContain('root = ')
    expect(
      Object.values(resolveDocument(instance.document).nodes).some((node) => node.component === kind),
    ).toBe(true)
    const host = document.createElement('div')
    document.body.append(host)
    handle = mountRenderer(host, instance)
    await flushPromises()
    expect(host.shadowRoot?.querySelector('.lingui-surface')).not.toBeNull()
  })
  it('searches by purpose, resets preview state, and restores focus after clearing a search', async () => {
    view = mount(CatalogView, { attachTo: document.body })
    await view.get('[aria-label="搜索基础组件"]').setValue('滑块')
    await flushPromises()
    expect(view.findAll('.lu-catalog-item code').map((item) => item.text())).toEqual([
      'Slider',
      'RangeSlider',
    ])
    const host = view.get('.lingui-renderer-host').element
    const slider = renderedElement<HTMLInputElement>(host.shadowRoot!, 'input[type="range"]')!
    slider.value = '75'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(slider.value).toBe('75')
    await view
      .findAll('button')
      .find((button) => button.text().includes('重置预览'))!
      .trigger('click')
    await flushPromises()
    expect(
      renderedElement<HTMLInputElement>(
        view.get('.lingui-renderer-host').element.shadowRoot!,
        'input[type="range"]',
      )!.value,
    ).toBe('60')
    await view.get('[aria-label="搜索基础组件"]').setValue('没有这种组件')
    expect(view.find('.lingui-renderer-host').exists()).toBe(false)
    await view.get('[aria-label="清空搜索基础组件"]').trigger('click')
    await flushPromises()
    expect(view.findAll('.lu-catalog-item')).toHaveLength(componentNames.length)
    expect(document.activeElement).toBe(view.get('[aria-label="搜索基础组件"]').element)
  })
  it('keeps interaction state while switching preview theme and width, and resets explicitly', async () => {
    view = mount(CatalogView, { attachTo: document.body })
    await view.get('[aria-label="搜索基础组件"]').setValue('滑块')
    await flushPromises()
    const host = view.get('.lingui-renderer-host').element
    const slider = renderedElement<HTMLInputElement>(host.shadowRoot!, 'input[type="range"]')!
    slider.value = '73'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    await view.get('[aria-label="组件预览主题"]').setValue('graphite')
    await view
      .findAll('button')
      .find((button) => button.text() === '手机')!
      .trigger('click')
    await flushPromises()
    expect(renderedElement<HTMLInputElement>(host.shadowRoot!, 'input[type="range"]')!.value).toBe(
      '73',
    )
    expect(host.shadowRoot!.querySelector('.lingui-surface')!.getAttribute('data-mode')).toBe(
      'dark',
    )
    expect(view.get('.lu-catalog-preview-paper').classes()).toContain('is-mobile')
    expect(
      view
        .findAll('button')
        .find((button) => button.text() === '手机')!
        .attributes('aria-pressed'),
    ).toBe('true')
    await view
      .findAll('button')
      .find((button) => button.text().includes('重置预览'))!
      .trigger('click')
    await flushPromises()
    const resetHost = view.get('.lingui-renderer-host').element
    expect(
      renderedElement<HTMLInputElement>(resetHost.shadowRoot!, 'input[type="range"]')!.value,
    ).toBe('60')
    expect(resetHost.shadowRoot!.querySelector('.lingui-surface')!.getAttribute('data-mode')).toBe(
      'dark',
    )
  })
})
