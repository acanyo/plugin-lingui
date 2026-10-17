import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  createInstance,
  resolveDocument,
  mountRenderer,
  validateDocument,
  type ComponentNode,
  type RendererHandle,
  type State,
} from '@lingui/renderer'
import {
  column,
  document as definition,
  text,
} from '../../../packages/renderer/src/examples/builders'
import { stepNumber, numberRange } from '../../../packages/renderer/src/renderer-core/inputs/ranges'
import {
  progressRing,
  funnelGeometry,
} from '../../../packages/renderer/src/renderer-core/charts/compact'
import { addNode, createBlankDocument, removeNode } from '../component-studio/document-editor'
import { editCarousel } from '../component-studio/carousel-editor'
import { reparentNode } from '../component-studio/reparent-editor'
import { updateBoundValue } from '../component-studio/value-editor'
import { staticPreview } from './helpers/static-preview'
import RangeProperties from '../component-studio/RangeProperties.vue'
import ResourceProperties from '../component-studio/ResourceProperties.vue'
import DesignProperties from '../component-studio/DesignProperties.vue'
const kinds = [
  'RangeSlider',
  'DateRange',
  'NumberStepper',
  'PasswordInput',
  'Combobox',
  'Transfer',
  'ToggleButton',
  'Carousel',
  'ScrollArea',
  'AspectRatio',
  'KeyboardShortcut',
  'FileCard',
  'AvatarGroup',
  'ProgressRing',
  'Sparkline',
  'FunnelChart',
].map((name) => `LingUI.${name}`) as ComponentNode['component'][]
const handles: RendererHandle[] = []
let view: VueWrapper | undefined
afterEach(async () => {
  view?.unmount()
  view = undefined
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  document.body.replaceChildren()
})
function render(nodes: ComponentNode[], state: State = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(mountRenderer(host, createInstance(definition('实用组件', nodes, state))))
  return host.shadowRoot!
}
function input(root: ShadowRoot, selector: string, value: string, event = 'input') {
  const control = root.querySelector<HTMLInputElement>(selector)!
  control.value = value
  control.dispatchEvent(new Event(event, { bubbles: true }))
  return control
}
function defaults(kind: ComponentNode['component']) {
  return addNode(createBlankDocument(), 'root', kind)
}
describe('productivity components', () => {
  it.each(kinds)('renders %s from validated manual defaults', async (kind) => {
    const added = defaults(kind)
    const document = validateDocument(added.document)
    const surface = resolveDocument(document)
    const root = render(Object.values(surface.nodes), surface.state)
    expect(root.querySelector('.lingui-surface')!.textContent!.trim()).not.toBe('')
    expect(root.querySelector('.lg-error')).toBeNull()
  })
  it('clamps crossing range endpoints and keeps atomic object state', async () => {
    const root = render(
      [
        column('root', ['range', 'out']),
        {
          id: 'range',
          component: 'LingUI.RangeSlider',
          label: '范围',
          min: 0,
          max: 100,
          value: { path: '/range' },
        },
        text('out', { path: '/range/start' }),
      ],
      { range: { start: 20, end: 70 } },
    )
    input(root, 'input[aria-valuetext="20"]', '90')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('70')
    expect(root.querySelectorAll('input')[1]!.value).toBe('70')
    input(root, 'input[aria-valuetext="70"]', '95')
    await flushPromises()
    expect(root.querySelectorAll('input')[0]!.value).toBe('70')
    const end = root.querySelectorAll('input')[1]!
    end.value = '10'
    end.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(end.value).toBe('70')
    expect(numberRange({ start: 1000, end: -1 }, 0, 100)).toEqual({ start: 0, end: 100 })
    expect(stepNumber(0.1, 1, 0, 1, 0.2)).toBe(0.3)
  })
  it('guards date order and bounds before committing state', async () => {
    const root = render(
      [
        {
          id: 'root',
          component: 'LingUI.DateRange',
          label: '计划',
          min: '2026-10-01',
          max: '2026-10-31',
          value: { path: '/dates' },
        },
      ],
      { dates: { start: '2026-10-10', end: '2026-10-20' } },
    )
    const triggers = root.querySelectorAll<HTMLButtonElement>('.lg-select-trigger')
    triggers[0]!.click()
    await flushPromises()
    expect(root.querySelector<HTMLButtonElement>('[data-date="2026-10-25"]')!.disabled).toBe(true)
    expect(root.querySelector<HTMLButtonElement>('[data-date="2026-09-30"]')!.disabled).toBe(true)
    root.querySelector<HTMLButtonElement>('[data-date="2026-10-15"]')!.click()
    await flushPromises()
    expect(triggers[0]!.textContent).toContain('2026-10-15')
    expect(triggers[1]!.textContent).toContain('2026-10-20')
    triggers[1]!.click()
    await flushPromises()
    const endPanel = root.querySelectorAll('.lg-date-panel')[1]!
    expect(endPanel.querySelector<HTMLButtonElement>('[data-date="2026-10-10"]')!.disabled).toBe(
      true,
    )
    expect(endPanel.querySelector<HTMLButtonElement>('[data-date="2026-11-01"]')!.disabled).toBe(
      true,
    )
  })
  it('steps decimals exactly and disables the upper boundary', async () => {
    const root = render(
      [
        {
          id: 'root',
          component: 'LingUI.NumberStepper',
          label: '数量',
          min: 0,
          max: 0.3,
          step: 0.2,
          value: { path: '/n' },
        },
      ],
      { n: 0.1 },
    )
    const plus = root.querySelector<HTMLButtonElement>('[aria-label="增加数值"]')!
    plus.click()
    await flushPromises()
    expect(root.querySelector('input')!.value).toBe('0.3')
    expect(plus.disabled).toBe(true)
  })
  it('restores the clamped stepper value even when state remains unchanged', async () => {
    const root = render(
      [
        {
          id: 'root',
          component: 'LingUI.NumberStepper',
          label: '数量',
          min: 0,
          max: 10,
          value: { path: '/n' },
        },
      ],
      { n: 10 },
    )
    input(root, 'input', '100', 'change')
    await flushPromises()
    expect(root.querySelector('input')!.value).toBe('10')
  })
  it('reveals local password entry without serializing it into static preview', async () => {
    const added = defaults('LingUI.PasswordInput'),
      surface = resolveDocument(added.document),
      node = surface.nodes[added.id]!
    const root = render(Object.values(surface.nodes), surface.state)
    input(root, 'input', 'local-demo')
    root.querySelector<HTMLButtonElement>('[aria-label="显示密码"]')!.click()
    await flushPromises()
    expect(root.querySelector('input')!.type).toBe('text')
    const document = updateBoundValue(added.document, node, 'initial-demo-secret')
    const fallback = await staticPreview(createInstance(document))
    expect(fallback.querySelector('input')!.value).toBe('')
    expect(fallback.innerHTML).not.toContain('initial-demo-secret')
  })
  it('searches, selects and clears a single option', async () => {
    const added = defaults('LingUI.Combobox'),
      surface = resolveDocument(added.document),
      root = render(Object.values(surface.nodes), surface.state)
    root.querySelector<HTMLButtonElement>('.lg-select-trigger')!.click()
    await flushPromises()
    input(root, 'input[type=search]', '数据')
    await flushPromises()
    expect(root.querySelectorAll('[role=option]')).toHaveLength(1)
    root.querySelector<HTMLButtonElement>('[role=option]')!.click()
    await flushPromises()
    expect(root.querySelector<HTMLButtonElement>('.lg-select-trigger')!.textContent).toContain(
      '数据图解',
    )
    expect(root.querySelector<HTMLDivElement>('.lg-floating-panel')!.hidden).toBe(true)
    root.querySelector<HTMLButtonElement>('.lg-select-trigger')!.click()
    await flushPromises()
    root.querySelector<HTMLButtonElement>('.lg-panel-footer button')!.click()
    await flushPromises()
    expect(root.querySelector<HTMLButtonElement>('.lg-select-trigger')!.textContent).toContain(
      '搜索并选择主题',
    )
  })
  it('moves only checked visible transfer options and supports returning them', async () => {
    const added = defaults('LingUI.Transfer'),
      surface = resolveDocument(added.document),
      root = render(Object.values(surface.nodes), surface.state)
    const available = root.querySelector('.lg-transfer-list')!
    available.querySelector<HTMLInputElement>('input')!.click()
    await flushPromises()
    input(root, 'input[type=search]', '不存在')
    await flushPromises()
    expect(root.querySelector<HTMLButtonElement>('[aria-label="添加到已选"]')!.disabled).toBe(true)
    input(root, 'input[type=search]', '')
    await flushPromises()
    root.querySelector<HTMLButtonElement>('[aria-label="添加到已选"]')!.click()
    await flushPromises()
    expect(root.querySelectorAll('.lg-transfer-list')[1]!.querySelectorAll('input')).toHaveLength(2)
    root.querySelectorAll('.lg-transfer-list')[1]!.querySelector<HTMLInputElement>('input')!.click()
    await flushPromises()
    root.querySelector<HTMLButtonElement>('[aria-label="移回待选"]')!.click()
    await flushPromises()
    expect(root.querySelectorAll('.lg-transfer-list')[1]!.querySelectorAll('input')).toHaveLength(1)
  })
  it('preserves nested carousel input state while switching slides', async () => {
    const root = render(
      [
        {
          id: 'root',
          component: 'LingUI.Carousel',
          label: '轮播',
          children: ['a', 'b'],
          value: { path: '/page' },
        },
        { id: 'a', component: 'TextField', label: '备注', value: { path: '/draft' } },
        text('b', '另一页'),
      ],
      { page: 0, draft: '' },
    )
    input(root, 'input', '记住这个内容')
    root.querySelector<HTMLButtonElement>('[aria-label="下一张"]')!.click()
    await flushPromises()
    expect(root.querySelectorAll<HTMLElement>('.lg-carousel-slide')[0]!.hidden).toBe(true)
    root.querySelector<HTMLButtonElement>('[aria-label="上一张"]')!.click()
    await flushPromises()
    expect(root.querySelector('input')!.value).toBe('记住这个内容')
  })
  it('prunes removed carousel pages, preserves index and protects the last page', () => {
    const added = defaults('LingUI.Carousel'),
      surface = resolveDocument(added.document),
      node = surface.nodes[added.id]!
    let doc = editCarousel(added.document, added.id, 'select', 2)
    doc = editCarousel(doc, added.id, 'remove', 0)
    expect(resolveDocument(doc).nodes[node.children![0]!]).toBeUndefined()
    expect(resolveDocument(doc).state.fields).toMatchObject({ [added.id]: 1 })
    doc = editCarousel(doc, added.id, 'remove', 0)
    expect(() => editCarousel(doc, added.id, 'remove', 0)).toThrow('至少保留')
    expect(() => removeNode(doc, resolveDocument(doc).nodes[added.id]!.children![0]!)).toThrow(
      '至少保留',
    )
    expect(() =>
      reparentNode(doc, resolveDocument(doc).nodes[added.id]!.children![0]!, 'root'),
    ).toThrow('至少保留')
    expect(() => reparentNode(doc, added.id, added.id)).toThrow('循环')
  })
  it('adds editable carousel pages and enforces capacity', () => {
    const added = defaults('LingUI.Carousel')
    let doc = added.document
    for (let i = 0; i < 9; i++) doc = editCarousel(doc, added.id, 'add')
    expect(validateDocument(doc)).toBeTruthy()
    expect(() => editCarousel(doc, added.id, 'add')).toThrow('12')
    expect(() => addNode(doc, added.id, 'Text')).toThrow('12')
  })
  it('keeps carousel selection when an unrelated node is removed', () => {
    const carousel = defaults('LingUI.Carousel'),
      extra = addNode(carousel.document, 'root', 'Text')
    let doc = editCarousel(extra.document, carousel.id, 'select', 2)
    doc = removeNode(doc, extra.id)
    expect(resolveDocument(doc).state.fields).toMatchObject({ [carousel.id]: 2 })
  })
  it('closes searchable selection with Escape and restores trigger focus', async () => {
    const added = defaults('LingUI.Combobox'),
      surface = resolveDocument(added.document),
      root = render(Object.values(surface.nodes), surface.state)
    const summary = root.querySelector<HTMLButtonElement>('.lg-select-trigger')!
    summary.click()
    await flushPromises()
    const search = root.querySelector<HTMLInputElement>('input[type=search]')!
    search.focus()
    search.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    await flushPromises()
    expect(root.querySelector<HTMLDivElement>('.lg-floating-panel')!.hidden).toBe(true)
    expect(root.activeElement).toBe(summary)
  })
  it.each(['LingUI.Combobox', 'LingUI.MultiSelect'] as const)(
    'consumes only the first Escape in an expanded %s',
    async (kind) => {
      const added = addNode(createBlankDocument(), 'root', kind)
      const surface = resolveDocument(added.document),
        root = render(Object.values(surface.nodes), surface.state)
      const parent = vi.fn()
      root.host.addEventListener('keydown', parent)
      root.host.addEventListener('keyup', parent)
      const summary = root.querySelector<HTMLButtonElement>('.lg-select-trigger')!
      summary.click()
      await flushPromises()
      const search = root.querySelector<HTMLInputElement>('input[type=search]')!
      search.focus()
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
      search.dispatchEvent(event)
      await flushPromises()
      summary.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, composed: true }),
      )
      expect(event.defaultPrevented).toBe(true)
      expect(parent).not.toHaveBeenCalled()
      expect(root.querySelector<HTMLDivElement>('.lg-floating-panel')!.hidden).toBe(true)
      expect(root.activeElement).toBe(summary)
      summary.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
      )
      expect(parent).toHaveBeenCalledOnce()
    },
  )
  it('keeps ring and funnel geometry finite at zero, bounds and large values', () => {
    for (const value of [-1e12, 0, 72, 100, 1e12, 'bad', null]) {
      const ring = progressRing(value, 100)
      expect(ring.path).not.toMatch(/NaN|Infinity/)
      expect(ring.ratio).toBeGreaterThanOrEqual(0)
      expect(ring.ratio).toBeLessThanOrEqual(1)
    }
    expect(progressRing(200, 100).actual).toBe(200)
    expect(
      funnelGeometry([
        { label: 'a', value: 0 },
        { label: 'b', value: 0 },
      ]).every((stage) => stage.ratio === 0 && !/NaN|Infinity/.test(stage.path)),
    ).toBe(true)
  })
  it('keeps all carousel slides, shortcuts and data readable in static fallback', async () => {
    let doc = createBlankDocument()
    for (const kind of [
      'LingUI.Carousel',
      'LingUI.ScrollArea',
      'LingUI.KeyboardShortcut',
      'LingUI.Sparkline',
      'LingUI.AvatarGroup',
    ] as const)
      doc = addNode(doc, 'root', kind).document
    const dom = await staticPreview(createInstance(doc))
    expect(
      [...dom.querySelectorAll<HTMLElement>('.lg-carousel-slide')].every((slide) => !slide.hidden),
    ).toBe(true)
    expect(dom.querySelector('kbd')!.textContent).toBe('⌘')
    expect(dom.querySelector('.lg-scroll-static')).not.toBeNull()
    expect(dom.textContent).toContain('第 7 天')
    expect(dom.querySelector('[role=img]')!.getAttribute('aria-label')).toContain('晓雨')
  })
  it('renders safe file links and declared avatar sources', async () => {
    const nodes: ComponentNode[] = [
      column('root', ['file', 'group']),
      { id: 'file', component: 'LingUI.FileCard', label: '文档', url: '#guide', newWindow: true },
      {
        id: 'group',
        component: 'LingUI.AvatarGroup',
        label: '团队',
        members: [{ label: '成员', url: '/avatar.png' }],
      },
    ]
    const dom = await staticPreview(createInstance(definition('资源', nodes)))
    expect(dom.querySelector('a')!.getAttribute('href')).toBe('#guide')
    expect(dom.querySelectorAll('img')).toHaveLength(1)
    expect(dom.querySelector('img')!.getAttribute('src')).toBe('/avatar.png')
  })
  it.each([
    { component: 'LingUI.RangeSlider', label: '范围', min: 1, max: 1, value: { path: '/n' } },
    { component: 'LingUI.DateRange', label: '日期', min: '2026-02-30', value: { path: '/dates' } },
    {
      component: 'LingUI.DateRange',
      label: '日期',
      min: '2026-11-01',
      max: '2026-10-01',
      value: { path: '/dates' },
    },
    { component: 'LingUI.Carousel', label: '轮播', children: ['a', 'a'], value: { path: '/page' } },
    { component: 'LingUI.FileCard', label: '文件', url: 'javascript:alert(1)' },
    {
      component: 'LingUI.AvatarGroup',
      label: '成员',
      members: [{ label: '甲', url: 'data:image/svg+xml,test' }],
    },
    {
      component: 'LingUI.FunnelChart',
      label: '流程',
      data: [
        { label: 'a', value: 2 },
        { label: 'b', value: 3 },
      ],
    },
    { component: 'LingUI.FunnelChart', label: '流程', data: [{ label: 'a', value: 2 }] },
    {
      component: 'LingUI.Combobox',
      label: '选择',
      value: { path: '/c' },
      options: [
        { label: 'a', value: 'same' },
        { label: 'b', value: 'same' },
      ],
    },
  ])('rejects inconsistent or unsafe data %#', (node) => {
    expect(() =>
      validateDocument(
        definition('校验', [{ id: 'root', ...node } as ComponentNode, text('a', '内容')]),
      ),
    ).toThrow()
  })
  it('rejects crossing initial ranges and invalid member URLs in manual editors', async () => {
    const added = defaults('LingUI.RangeSlider'),
      surface = resolveDocument(added.document)
    view = mount(RangeProperties, {
      props: { node: surface.nodes[added.id]!, document: added.document, state: surface.state },
    })
    const nums = view.findAll('input[type=number]')
    await nums[3]!.setValue(900)
    expect(view.find('[role=alert]').text()).toContain('上限')
    expect(view.emitted('document')).toBeUndefined()
    view.unmount()
    const avatars = defaults('LingUI.AvatarGroup')
    view = mount(ResourceProperties, {
      props: { node: resolveDocument(avatars.document).nodes[avatars.id]! },
    })
    await view.findAll('input')[1]!.setValue('javascript:alert(1)')
    expect(view.find('[role=alert]').text()).toContain('地址')
    expect(view.emitted('update')).toBeUndefined()
  })
  it('prevents out of order funnel edits and preserves negative sparkline values', async () => {
    const added = defaults('LingUI.FunnelChart')
    view = mount(DesignProperties, {
      props: { node: resolveDocument(added.document).nodes[added.id]! },
    })
    await view.findAll('input[type=number]')[1]!.setValue(1200)
    expect(view.find('[role=alert]').text()).toContain('非递增')
    expect(view.emitted('update')).toBeUndefined()
    view.unmount()
    const spark = defaults('LingUI.Sparkline')
    view = mount(DesignProperties, {
      props: { node: resolveDocument(spark.document).nodes[spark.id]! },
    })
    await view.find('input[type=number]').setValue(-5)
    expect((view.emitted('update')![0]![0] as ComponentNode).data![0]!.value).toBe(-5)
  })
})
