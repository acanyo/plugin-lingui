import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createInstance, mountRenderer, type RendererHandle } from '@lingui/renderer'
import { column, document as definition } from '../../../packages/renderer/src/examples/builders'
import { rangePercent } from '../../../packages/renderer/src/renderer-core/inputs/ranges'
import { shortChartNumber } from '../../../packages/renderer/src/renderer-core/charts/formatting'
let handle: RendererHandle | undefined
afterEach(async () => {
  await handle?.destroy()
  handle = undefined
  document.body.replaceChildren()
})
describe('component detail boundaries', () => {
  it('calculates slider fills for clamped, negative and fractional ranges', () => {
    expect(rangePercent(-100, -50, 50)).toBe(0)
    expect(rangePercent(0, -50, 50)).toBe(50)
    expect(rangePercent(100, -50, 50)).toBe(100)
    expect(rangePercent(0.15, 0.1, 0.2)).toBeCloseTo(50)
    expect(rangePercent(undefined, 20, 80)).toBe(0)
    expect(rangePercent(5, 5, 5)).toBe(0)
  })
  it('restores repeated out-of-range numeric edits when the bounded value is unchanged', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    handle = mountRenderer(host, createInstance(definition('边界输入', [
      { id: 'root', component: 'LingUI.NumberInput', label: '数量', min: 0, max: 100, value: { path: '/number' } },
    ], { number: 100 })))
    const input = host.shadowRoot!.querySelector<HTMLInputElement>('input')!
    for (const value of ['200', '300']) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await flushPromises()
      expect(input.value).toBe('100')
    }
  })
  it('keeps large chart axes short and exposes exact values in titles and data', async () => {
    expect(shortChartNumber(12.34)).toBe('12.34')
    expect(shortChartNumber(1e12)).toBe('1万亿')
    expect(shortChartNumber(-1e12)).toBe('-1万亿')
    const host = document.createElement('div')
    document.body.append(host)
    handle = mountRenderer(
      host,
      createInstance(
        definition('大数值', [
          column('root', ['gauge', 'waterfall']),
          {
            id: 'gauge',
            component: 'LingUI.Gauge',
            label: '当前值',
            value: 1e12,
            min: 0,
            max: 1e12,
          },
          {
            id: 'waterfall',
            component: 'LingUI.WaterfallChart',
            label: '总额',
            data: [{ label: '第一阶段', value: 1e12 }],
          },
        ]),
      ),
    )
    await flushPromises()
    const root = host.shadowRoot!
    expect(root.querySelector('.lg-gauge-number strong')?.textContent).toBe('1万亿')
    expect(root.querySelector('.lg-gauge-number strong')?.getAttribute('aria-label')).toBe(
      '1,000,000,000,000',
    )
    expect(root.querySelector('.lg-waterfall-total strong')?.getAttribute('title')).toBe(
      '1,000,000,000,000',
    )
    expect(root.querySelector('.lg-waterfall-legend')?.textContent).toContain('1,000,000,000,000')
    expect([...root.querySelectorAll('svg text')].map((el) => el.textContent)).toContain('1万亿')
  })
})
