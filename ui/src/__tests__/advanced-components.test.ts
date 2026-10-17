import { afterEach, describe, expect, it } from 'vitest'
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
  dispatch,
} from '../../../packages/renderer/src/examples/builders'
import {
  gaugeGeometry,
  radarGeometry,
  heatLevel,
} from '../../../packages/renderer/src/renderer-core/charts/analytics'
import { pageItems, stringList } from '../../../packages/renderer/src/renderer-core/inputs/values'
import { addNode, createBlankDocument, removeNode } from '../component-studio/document-editor'
import { editAccordion } from '../component-studio/accordion-editor'
import { staticPreview } from './helpers/static-preview'
import AdvancedInputProperties from '../component-studio/AdvancedInputProperties.vue'
import AnalyticsProperties from '../component-studio/AnalyticsProperties.vue'

const kinds = [
  'LingUI.SearchInput',
  'LingUI.ColorPicker',
  'LingUI.MultiSelect',
  'LingUI.TagInput',
  'LingUI.Pagination',
  'LingUI.Alert',
  'LingUI.Status',
  'LingUI.Tooltip',
  'LingUI.Accordion',
  'LingUI.LabeledDivider',
  'LingUI.Toolbar',
  'LingUI.Gauge',
  'LingUI.RadarChart',
  'LingUI.Heatmap',
] as const
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
  handles.push(mountRenderer(host, createInstance(definition('更多基础组件', nodes, state))))
  return host.shadowRoot!
}
function input(root: ShadowRoot, selector: string, value: string, event = 'input') {
  const input = root.querySelector<HTMLInputElement>(selector)!
  input.value = value
  input.dispatchEvent(new Event(event, { bubbles: true }))
  return input
}
const options = [
  { label: '界面', value: 'ui' },
  { label: '交互', value: 'ux' },
  { label: '图表', value: 'charts' },
]
describe('additional component capabilities', () => {
  it.each(kinds)('preserves editable %s through serialization and static preview', async (kind) => {
    const added = addNode(createBlankDocument(), 'root', kind)
    const doc = validateDocument(JSON.parse(JSON.stringify(added.document)))
    const fallback = await staticPreview(createInstance(doc))
    expect(fallback.textContent?.trim()).toBeTruthy()
    expect(fallback.querySelector('script, [onclick]')).toBeNull()
    expect(Object.keys(resolveDocument(validateDocument(removeNode(doc, added.id))).nodes)).toEqual(
      ['root'],
    )
  })
  it('updates search-linked content, clears it and restores input focus', async () => {
    const root = render(
      [
        column('root', ['search', 'result']),
        { id: 'search', component: 'LingUI.SearchInput', label: '搜索', value: { path: '/query' } },
        text('result', { path: '/query' }),
      ],
      { query: '' },
    )
    input(root, 'input', '设计')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('设计')
    root.querySelector<HTMLButtonElement>('button')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('')
    expect(root.activeElement).toBe(root.querySelector('input'))
  })
  it('validates typed color values and updates the color swatch without injecting styles', async () => {
    const root = render(
      [
        column('root', ['color', 'result']),
        { id: 'color', component: 'LingUI.ColorPicker', label: '颜色', value: { path: '/color' } },
        text('result', { path: '/color' }),
      ],
      { color: '#2563eb' },
    )
    input(root, 'input[type=text]', 'url(x)', 'change')
    await flushPromises()
    expect(root.querySelector('[role=alert]')!.textContent).toContain('六位')
    expect(root.querySelector('.lg-text')!.textContent).toBe('#2563eb')
    input(root, 'input[type=text]', '#AABBCC', 'change')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('#aabbcc')
    expect(root.querySelector<HTMLElement>('.lg-color-swatch')!.style.background).toBe(
      'rgb(170, 187, 204)',
    )
  })
  it('filters multi-select options, respects its limit, clears and remains isolated', async () => {
    const nodes: ComponentNode[] = [
      {
        id: 'root',
        component: 'LingUI.MultiSelect',
        label: '分类',
        options,
        maxSelected: 2,
        value: { path: '/selected' },
      },
    ]
    const root = render(nodes, { selected: ['ui'] }),
      other = render(nodes, { selected: ['ui'] })
    root.querySelector<HTMLButtonElement>('.lg-select-trigger')!.click()
    await flushPromises()
    const choices = root.querySelectorAll<HTMLButtonElement>('[role=option]')
    choices[1]!.click()
    await flushPromises()
    expect(choices[2]!.disabled).toBe(true)
    expect(root.querySelector('.lg-selected-tags')!.textContent).toContain('交互')
    expect(other.querySelector('.lg-selected-tags')!.textContent).not.toContain('交互')
    input(root, 'input[type=search]', '不存在')
    await flushPromises()
    expect(root.querySelectorAll('[role=option]')).toHaveLength(0)
    expect(root.querySelector('[role=status]')!.textContent).toContain('没有匹配')
    root.querySelector<HTMLButtonElement>('.lg-panel-footer button')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-selected-tags')).toBeNull()
    expect(root.querySelector('.lg-panel-footer')!.textContent).toContain('0 / 2')
    root
      .querySelector('.lg-select-trigger')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))
    await flushPromises()
    expect(root.querySelector<HTMLDivElement>('.lg-floating-panel')!.hidden).toBe(true)
  })
  it('adds unique tags, guards IME, removes with Backspace and exposes the limit', async () => {
    const root = render(
      [
        {
          id: 'root',
          component: 'LingUI.TagInput',
          label: '标签',
          value: { path: '/tags' },
          maxTags: 2,
        },
      ],
      { tags: [] },
    )
    const field = input(root, 'input', '界面')
    await flushPromises()
    field.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', isComposing: true }),
    )
    await flushPromises()
    expect(root.querySelectorAll('.lg-input-tag')).toHaveLength(0)
    field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await flushPromises()
    expect(root.querySelectorAll('.lg-input-tag')).toHaveLength(1)
    input(root, 'input', '界面')
    await flushPromises()
    root.querySelector<HTMLButtonElement>('.lg-tag-add')!.click()
    await flushPromises()
    expect(root.textContent).toContain('已经添加')
    input(root, 'input', '交互')
    await flushPromises()
    root.querySelector<HTMLButtonElement>('.lg-tag-add')!.click()
    await flushPromises()
    input(root, 'input', '图表')
    await flushPromises()
    root.querySelector<HTMLButtonElement>('.lg-tag-add')!.click()
    await flushPromises()
    expect(root.querySelector<HTMLButtonElement>('.lg-tag-add')!.disabled).toBe(true)
    field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await flushPromises()
    expect(root.querySelector('.lg-caption')!.textContent).toContain('最多添加 2')
    input(root, 'input', '')
    await flushPromises()
    field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace' }))
    await flushPromises()
    expect(root.querySelectorAll('.lg-input-tag')).toHaveLength(1)
    root.querySelector<HTMLButtonElement>('.lg-input-tag button')!.click()
    await flushPromises()
    expect(root.querySelectorAll('.lg-input-tag')).toHaveLength(0)
    expect(root.activeElement).toBe(field)
  })
  it.each([
    'LingUI.SearchInput',
    'LingUI.ColorPicker',
    'LingUI.MultiSelect',
    'LingUI.TagInput',
    'LingUI.Pagination',
  ] as const)('keeps disabled %s state unchanged', async (component) => {
    const node: ComponentNode = {
      id: 'control',
      component,
      label: '字段',
      value: { path: '/value' },
      disabled: { path: '/locked' },
      ...(component === 'LingUI.MultiSelect' ? { options } : {}),
      ...(component === 'LingUI.Pagination' ? { totalPages: 5 } : {}),
    }
    const initial =
      component === 'LingUI.MultiSelect' || component === 'LingUI.TagInput'
        ? []
        : component === 'LingUI.Pagination'
          ? 1
          : '#2563eb'
    const root = render(
      [column('root', ['control', 'output']), node, text('output', { path: '/value' })],
      { value: initial, locked: true },
    )
    const before = root.querySelector('.lg-text')!.textContent
    for (const field of root.querySelectorAll('input')) {
      field.value = '#ffffff'
      field.dispatchEvent(new Event('input'))
      field.dispatchEvent(new Event('change'))
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    }
    for (const button of root.querySelectorAll('button')) button.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe(before)
  })
  it('binds pagination to local content and clamps invalid/out-of-range runtime values', async () => {
    const root = render(
      [
        column('root', ['pages', 'output']),
        {
          id: 'pages',
          component: 'LingUI.Pagination',
          label: '翻页',
          value: { path: '/page' },
          totalPages: 10000,
        },
        text('output', { path: '/page' }),
      ],
      { page: 1 },
    )
    expect(root.querySelectorAll('button').length).toBeLessThanOrEqual(9)
    root.querySelector<HTMLButtonElement>('[aria-label="第 10000 页"]')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('10000')
    expect(root.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.disabled).toBe(true)
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('dismisses and resets alert state', async () => {
    const root = render(
      [
        column('root', ['alert', 'reset']),
        {
          id: 'alert',
          component: 'LingUI.Alert',
          title: '提示',
          value: { path: '/visible' },
          dismissible: true,
        },
        {
          id: 'reset',
          component: 'Button',
          child: 'reset-text',
          action: dispatch({ type: 'reset' }),
        },
        text('reset-text', '重置'),
      ],
      { visible: true },
    )
    root.querySelector<HTMLButtonElement>('[aria-label="关闭提示"]')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-alert')).toBeNull()
    root.querySelector<HTMLButtonElement>('.lg-button')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-alert')).not.toBeNull()
  })
  it('shows tooltip on focus and touch click, Escape hides it while keeping focus', async () => {
    const root = render([
      { id: 'root', component: 'LingUI.Tooltip', label: '说明', text: '详细说明' },
    ])
    const trigger = root.querySelector<HTMLButtonElement>('button')!,
      tip = root.querySelector<HTMLElement>('[role=tooltip]')!
    expect(tip.hidden).toBe(true)
    trigger.focus()
    await flushPromises()
    expect(tip.hidden).toBe(false)
    trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await flushPromises()
    expect(tip.hidden).toBe(true)
    expect(root.activeElement).toBe(trigger)
    trigger.click()
    await flushPromises()
    expect(tip.hidden).toBe(false)
  })
  it('enforces single accordion expansion and preserves groups when renamed or removed', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.Accordion')
    const surface = resolveDocument(added.document),
      sections = surface.nodes[added.id]!.sections!
    const host = document.createElement('div')
    document.body.append(host)
    handles.push(mountRenderer(host, createInstance(added.document)))
    const root = host.shadowRoot!,
      details = root.querySelectorAll('details')
    expect(details[0]!.open).toBe(true)
    details[1]!.querySelector('summary')!.click()
    await flushPromises()
    expect(details[0]!.open).toBe(false)
    expect(details[1]!.open).toBe(true)
    let doc = editAccordion(added.document, added.id, 'rename', 0, '新的标题')
    doc = editAccordion(doc, added.id, 'remove', 0)
    doc = validateDocument(editAccordion(doc, added.id, 'add'))
    expect(resolveDocument(doc).nodes[sections[0]!.child]).toBeUndefined()
    expect(resolveDocument(doc).nodes[added.id]!.sections).toHaveLength(3)
  })
  it('normalizes unsafe state lists without prototype values or duplicate entries', () => {
    expect(stringList([null, 2, '', 'a', 'a', 'b'], 2)).toEqual(['a', 'b'])
  })
  it('keeps gauges and radar geometry finite and preserves the actual gauge value', () => {
    for (const value of [-1000, 0, 100, 1000, 'bad', null]) {
      const gauge = gaugeGeometry(value, 0, 100)
      expect(gauge.ratio).toBeGreaterThanOrEqual(0)
      expect(gauge.ratio).toBeLessThanOrEqual(1)
      expect(gauge.path).not.toMatch(/NaN|Infinity/)
    }
    expect(gaugeGeometry(150, 0, 100).actual).toBe(150)
    const radar = radarGeometry(
      [
        { label: 'A', value: 0 },
        { label: 'B', value: 100 },
        { label: 'C', value: 50 },
      ],
      100,
    )
    expect(radar.area).not.toMatch(/NaN|Infinity/)
    expect(radar.grid).toHaveLength(4)
    expect(heatLevel(0, 0)).toBe(0)
    expect(heatLevel(100, 100)).toBe(4)
  })
  it.each([
    { component: 'LingUI.Gauge', label: '刻度', min: 1, max: 1, value: 1 },
    {
      component: 'LingUI.RadarChart',
      label: '雷达',
      max: 10,
      data: [
        { label: 'A', value: 11 },
        { label: 'B', value: 5 },
        { label: 'C', value: 2 },
      ],
    },
    {
      component: 'LingUI.Heatmap',
      label: '热力',
      columns: ['A', 'B'],
      matrix: [{ label: '行', cells: [1] }],
    },
    { component: 'LingUI.Pagination', label: '页', totalPages: 0, value: { path: '/page' } },
    {
      component: 'LingUI.Accordion',
      value: { path: '/open' },
      sections: [
        { title: 'A', child: 'child' },
        { title: 'B', child: 'child' },
      ],
    },
  ])('rejects invalid analytical or composition values %#', (node) => {
    expect(() =>
      validateDocument(
        definition('校验', [{ id: 'root', ...node } as ComponentNode, text('child', '内容')]),
      ),
    ).toThrow()
  })
  it('retains radar labels and heatmap values in static preview', async () => {
    let doc = createBlankDocument()
    doc = addNode(doc, 'root', 'LingUI.RadarChart').document
    doc = addNode(doc, 'root', 'LingUI.Heatmap').document
    const fallback = await staticPreview(createInstance(doc))
    expect(fallback.querySelectorAll('svg text')).toHaveLength(5)
    expect(fallback.querySelector('table')).not.toBeNull()
    expect(fallback.textContent).toContain('易用性')
    expect(fallback.textContent).toContain('6次')
  })
  it('edits multi-select defaults and refuses invalid color or excessive selections', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.MultiSelect'),
      surface = resolveDocument(added.document),
      node = surface.nodes[added.id]!
    view = mount(AdvancedInputProperties, {
      props: { node: { ...node, maxSelected: 1 }, document: added.document, state: surface.state },
    })
    await view.findAll('fieldset input')[1]!.setValue(true)
    expect(view.find('[role=alert]').text()).toContain('数量上限')
    expect(view.emitted('document')).toBeUndefined()
  })
  it('edits heatmap columns atomically and prevents inconsistent radar scale changes', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.Heatmap'),
      surface = resolveDocument(added.document)
    view = mount(AnalyticsProperties, {
      props: { node: surface.nodes[added.id]!, document: added.document, state: surface.state },
    })
    await view
      .findAll('button')
      .find((button) => button.text() === '添加列')!
      .trigger('click')
    const node = view.emitted('update')!.at(-1)![0] as ComponentNode
    expect(node.columns).toHaveLength(6)
    expect(node.matrix!.every((row) => row.cells.length === 6)).toBe(true)
    view.unmount()
    const radar = addNode(createBlankDocument(), 'root', 'LingUI.RadarChart'),
      radarSurface = resolveDocument(radar.document)
    view = mount(AnalyticsProperties, {
      props: {
        node: radarSurface.nodes[radar.id]!,
        document: radar.document,
        state: radarSurface.state,
      },
    })
    await view.get('input[type=number]').setValue(1)
    expect(view.find('[role=alert]').text()).toContain('刻度上限')
    expect(view.emitted('update')).toBeUndefined()
  })
})
