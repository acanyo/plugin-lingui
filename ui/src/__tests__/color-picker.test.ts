import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  createInstance,
  mountRenderer,
  type ComponentNode,
  type RendererHandle,
} from '@lingui/renderer'
import {
  column,
  document as definition,
  text,
  dispatch,
} from '../../../packages/renderer/src/examples/builders'
import { hexToHsv, hsvToHex } from '../../../packages/renderer/src/renderer-core/inputs/colors'

const handles: RendererHandle[] = []
afterEach(async () => {
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  document.body.replaceChildren()
})
function render(extra: ComponentNode[] = [], locked = false) {
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(
    mountRenderer(
      host,
      createInstance(
        definition(
          '选色',
          [
            column('root', ['color', 'output', ...extra.map((node) => node.id)]),
            {
              id: 'color',
              component: 'LingUI.ColorPicker',
              label: '主题颜色',
              value: { path: '/color' },
              disabled: { path: '/locked' },
            },
            text('output', { path: '/color' }),
            ...extra,
          ],
          { color: '#2563eb', locked },
        ),
      ),
    ),
  )
  return host.shadowRoot!
}
async function adjust(root: ShadowRoot, name: string, value: string) {
  const input = root.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
describe('web color palette', () => {
  it('round-trips exact RGB colors, handles hue wrapping and keeps a neutral color hue', () => {
    for (const color of [
      '#ffffff',
      '#000000',
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#f97316',
      '#aabbcc',
      '#2563eb',
      '#64748b',
    ]) {
      expect(hsvToHex(hexToHsv(color))).toBe(color)
    }
    expect(hexToHsv('#ffffff', 220).hue).toBe(220)
    expect(hsvToHex({ hue: 360, saturation: 100, brightness: 100 })).toBe('#ff0000')
    expect(hsvToHex({ hue: -120, saturation: 100, brightness: 100 })).toBe('#0000ff')
  })
  it('opens an actual web palette and applies a preset to linked content', async () => {
    const root = render()
    const trigger = root.querySelector<HTMLButtonElement>('.lg-color-toggle')!
    trigger.click()
    await flushPromises()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(root.querySelectorAll('.lg-color-presets button')).toHaveLength(12)
    expect(root.activeElement).toBe(root.querySelector('[aria-label="蓝色 #2563eb"]'))
    const preset = root.querySelector<HTMLButtonElement>('[aria-label="紫色 #8b5cf6"]')!
    preset.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('#8b5cf6')
    expect(preset.getAttribute('aria-pressed')).toBe('true')
    expect(root.querySelector<HTMLInputElement>('input[type=text]')!.value).toBe('#8b5cf6')
    root.querySelector<HTMLButtonElement>('.lg-color-done')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-color-panel')).toBeNull()
    expect(root.activeElement).toBe(trigger)
  })
  it('supports arbitrary colors and retains hue and saturation after going black', async () => {
    const root = render()
    root.querySelector<HTMLButtonElement>('.lg-color-toggle')!.click()
    await flushPromises()
    await adjust(root, '色相', '120')
    await adjust(root, '饱和度', '100')
    await adjust(root, '亮度', '100')
    expect(root.querySelector('.lg-text')!.textContent).toBe('#00ff00')
    await adjust(root, '亮度', '0')
    expect(root.querySelector('.lg-text')!.textContent).toBe('#000000')
    await adjust(root, '亮度', '100')
    expect(root.querySelector('.lg-text')!.textContent).toBe('#00ff00')
    await adjust(root, '饱和度', '0')
    expect(root.querySelector('.lg-text')!.textContent).toBe('#ffffff')
    await adjust(root, '饱和度', '100')
    expect(root.querySelector('.lg-text')!.textContent).toBe('#00ff00')
  })
  it('consumes Escape inside the palette and closes on outside click', async () => {
    const root = render()
    const trigger = root.querySelector<HTMLButtonElement>('.lg-color-toggle')!
    let escaped = 0
    const listen = () => escaped++
    window.addEventListener('keydown', listen)
    window.addEventListener('keyup', listen)
    try {
      trigger.click()
      await flushPromises()
      const preset = root.querySelector<HTMLButtonElement>('.lg-color-presets button')!
      preset.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
      )
      await flushPromises()
      trigger.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, composed: true }),
      )
      expect(escaped).toBe(0)
      expect(root.querySelector('.lg-color-panel')).toBeNull()
      expect(root.activeElement).toBe(trigger)
      trigger.click()
      await flushPromises()
      document.body.click()
      await flushPromises()
      expect(root.querySelector('.lg-color-panel')).toBeNull()
    } finally {
      window.removeEventListener('keydown', listen)
      window.removeEventListener('keyup', listen)
    }
  })
  it('normalizes repeated HEX edits, resets sliders and isolates preview instances', async () => {
    const root = render([
      {
        id: 'reset',
        component: 'Button',
        child: 'reset-copy',
        action: dispatch({ type: 'reset' }),
      },
      text('reset-copy', '重置'),
    ])
    const other = render()
    root.querySelector<HTMLButtonElement>('.lg-color-toggle')!.click()
    await flushPromises()
    const input = root.querySelector<HTMLInputElement>('input[type=text]')!
    for (let attempt = 0; attempt < 2; attempt++) {
      input.value = '#FF0000'
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()
      expect(input.value).toBe('#ff0000')
    }
    expect(root.querySelector<HTMLInputElement>('[aria-label="色相"]')!.value).toBe('0')
    expect(other.querySelector('.lg-text')!.textContent).toBe('#2563eb')
    root.querySelector<HTMLButtonElement>('.lg-button')!.click()
    await flushPromises()
    root.querySelector<HTMLButtonElement>('.lg-color-toggle')!.click()
    await flushPromises()
    expect(input.value).toBe('#2563eb')
    expect(Number(root.querySelector<HTMLInputElement>('[aria-label="色相"]')!.value)).toBeCloseTo(
      221,
      0,
    )
  })
  it('closes an open palette when disabled and ignores further edits', async () => {
    const root = render([
      { id: 'lock', component: 'LingUI.Switch', label: '锁定', value: { path: '/locked' } },
    ])
    root.querySelector<HTMLButtonElement>('.lg-color-toggle')!.click()
    await flushPromises()
    root.querySelector<HTMLButtonElement>('[role=switch]')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-color-panel')).toBeNull()
    expect(root.querySelector<HTMLButtonElement>('.lg-color-toggle')!.disabled).toBe(true)
    const input = root.querySelector<HTMLInputElement>('input[type=text]')!
    input.value = '#ffffff'
    input.dispatchEvent(new Event('change', { bubbles: true }))
    root.querySelector<HTMLButtonElement>('.lg-color-toggle')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('#2563eb')
    expect(root.querySelector('.lg-color-panel')).toBeNull()
  })
})
