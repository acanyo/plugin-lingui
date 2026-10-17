import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  createInstance,
  resolveDocument,
  mountRenderer,
  safeLinkUrl,
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
  lineGeometry,
  donutGeometry,
} from '../../../packages/renderer/src/renderer-core/charts/geometry'
import { addNode, createBlankDocument, removeNode } from '../component-studio/document-editor'
import { staticPreview } from './helpers/static-preview'
import ChoiceProperties from '../component-studio/ChoiceProperties.vue'
import NavigationProperties from '../component-studio/NavigationProperties.vue'
import DesignProperties from '../component-studio/DesignProperties.vue'
import FormValueProperties from '../component-studio/FormValueProperties.vue'

const kinds = [
  'LingUI.Switch',
  'LingUI.Select',
  'LingUI.SegmentedControl',
  'LingUI.Rating',
  'LingUI.Avatar',
  'LingUI.Link',
  'LingUI.Breadcrumbs',
  'LingUI.EmptyState',
  'LingUI.Skeleton',
  'LingUI.Spinner',
  'LingUI.LineChart',
  'LingUI.DonutChart',
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
  handles.push(mountRenderer(host, createInstance(definition('扩展组件', nodes, state))))
  return host.shadowRoot!
}
describe('extended component library', () => {
  it('changes the initial selection through the inspector and keeps its parameter default aligned', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.Select')
    const surface = resolveDocument(added.document)
    const node = surface.nodes[added.id]!
    const path = (node.value as { path: string }).path
    const doc = {
      ...added.document,
      parameters: [{ key: 'choice', label: '分类', type: 'string' as const, path, default: 'all' }],
    }
    view = mount(FormValueProperties, { props: { node, document: doc, state: surface.state } })
    await view.get('select').setValue('done')
    const next = view.emitted('document')!.at(-1)![0] as typeof doc
    expect(next.parameters[0]!.default).toBe('done')
    expect(() => validateDocument(next)).not.toThrow()
  })
  it.each(kinds)('adds, serializes and removes editable %s defaults', async (kind) => {
    const added = addNode(createBlankDocument(), 'root', kind)
    const doc = validateDocument(JSON.parse(JSON.stringify(added.document)))
    expect(resolveDocument(doc).nodes[added.id]!.component).toBe(kind)
    const fallback = await staticPreview(createInstance(doc))
    expect(fallback.textContent?.trim()).toBeTruthy()
    expect(fallback.querySelector('script, [onclick]')).toBeNull()
    expect(Object.keys(resolveDocument(validateDocument(removeNode(doc, added.id))).nodes)).toEqual(
      ['root'],
    )
  })
  it('binds switches to conditional content, isolates instances and resets state', async () => {
    const nodes: ComponentNode[] = [
      column('root', ['switch', 'conditional', 'reset']),
      { id: 'switch', component: 'LingUI.Switch', label: '显示说明', value: { path: '/show' } },
      {
        id: 'conditional',
        component: 'LingUI.Conditional',
        condition: { path: '/show' },
        child: 'details',
      },
      text('details', '更多内容'),
      {
        id: 'reset',
        component: 'Button',
        child: 'reset-label',
        action: dispatch({ type: 'reset' }),
      },
      text('reset-label', '重置'),
    ]
    const first = render(nodes, { show: false }),
      second = render(nodes, { show: false })
    first.querySelector<HTMLButtonElement>('[role=switch]')!.click()
    await flushPromises()
    expect(first.querySelector('[role=switch]')!.getAttribute('aria-checked')).toBe('true')
    expect(first.textContent).toContain('更多内容')
    expect(second.querySelector('[role=switch]')!.getAttribute('aria-checked')).toBe('false')
    first.querySelector<HTMLButtonElement>('.lg-button')!.click()
    await flushPromises()
    expect(first.querySelector('[role=switch]')!.getAttribute('aria-checked')).toBe('false')
  })
  it.each(['LingUI.Select', 'LingUI.SegmentedControl'] as const)(
    'uses a single string for %s and updates dependent text',
    async (component) => {
      const root = render(
        [
          column('root', ['picker', 'result']),
          {
            id: 'picker',
            component,
            label: '范围',
            value: { path: '/choice' },
            options: [
              { label: '全部', value: 'all' },
              { label: '完成', value: 'done' },
            ],
          },
          text('result', { path: '/choice' }),
        ],
        { choice: 'all' },
      )
      if (component === 'LingUI.Select') {
        root.querySelector<HTMLButtonElement>('[role=combobox]')!.click()
        await flushPromises()
        root.querySelectorAll<HTMLButtonElement>('[role=option]')[2]!.click()
      } else {
        root
          .querySelector('input[value=done]')!
          .dispatchEvent(new Event('change', { bubbles: true }))
      }
      await flushPromises()
      expect(root.querySelector('.lg-text')!.textContent).toBe('done')
    },
  )
  it('rates, clears and respects read-only controls', async () => {
    const node: ComponentNode = {
      id: 'rating',
      component: 'LingUI.Rating',
      label: '体验',
      value: { path: '/score' },
      max: 5,
    }
    const root = render(
      [column('root', ['rating', 'value']), node, text('value', { path: '/score' })],
      { score: 2 },
    )
    root
      .querySelector<HTMLInputElement>('input[value="5"]')!
      .dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('5')
    root.querySelector<HTMLButtonElement>('.lg-rating-clear')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('0')
    const readonly = render(
      [
        column('root', ['rating', 'value']),
        { ...node, readOnly: true },
        text('value', { path: '/score' }),
      ],
      { score: 2 },
    )
    readonly
      .querySelector('input[value="5"]')!
      .dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(readonly.querySelector('.lg-text')!.textContent).toBe('2')
    expect(readonly.querySelector('fieldset')!.disabled).toBe(true)
  })
  it('does not change state when disabled through a binding', async () => {
    const root = render(
      [
        column('root', ['switch', 'value']),
        {
          id: 'switch',
          component: 'LingUI.Switch',
          label: '偏好',
          value: { path: '/value' },
          disabled: { path: '/locked' },
        },
        text('value', { path: '/value' }),
      ],
      { value: false, locked: true },
    )
    root.querySelector<HTMLButtonElement>('button')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('false')
  })
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    '//evil.example',
    '/\\evil.example',
    'https://user:pass@example.com',
    'https://example.com/\nfoo',
  ])('rejects unsafe navigation %s statically and after binding resolution', (url) => {
    expect(safeLinkUrl(url)).toBeUndefined()
    expect(() =>
      validateDocument(
        definition('链接', [{ id: 'root', component: 'LingUI.Link', text: '链接', url }]),
      ),
    ).toThrow()
    const root = render(
      [{ id: 'root', component: 'LingUI.Link', text: '链接', url: { path: '/url' } }],
      { url },
    )
    expect(root.querySelector('a')).toBeNull()
    expect(() =>
      validateDocument(
        definition('导航', [
          { id: 'root', component: 'LingUI.Breadcrumbs', items: [{ label: '上级', url }] },
        ]),
      ),
    ).toThrow()
  })
  it('opens safe links with isolated opener and marks the current breadcrumb', () => {
    const root = render([
      column('root', ['link', 'crumbs']),
      {
        id: 'link',
        component: 'LingUI.Link',
        text: '文档',
        url: 'https://example.com/guide',
        newWindow: true,
      },
      {
        id: 'crumbs',
        component: 'LingUI.Breadcrumbs',
        items: [
          { label: '首页', url: '/home' },
          { label: '当前页', url: '/ignored' },
        ],
      },
    ])
    expect(root.querySelector('a')!.getAttribute('rel')).toContain('noopener')
    expect(root.querySelector('a')!.target).toBe('_blank')
    expect(root.querySelector('[aria-current=page]')!.textContent).toBe('当前页')
    expect(root.querySelectorAll('nav a')).toHaveLength(1)
    expect(safeLinkUrl('#section')).toBe('#section')
  })
  it('falls back to a text avatar when an image fails or its bound source is unsafe', async () => {
    const root = render([
      { id: 'root', component: 'LingUI.Avatar', label: '小林', url: '/avatar.png' },
    ])
    root.querySelector('img')!.dispatchEvent(new Event('error'))
    await flushPromises()
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('[role=img]')!.textContent).toBe('小林')
    const unsafe = render(
      [{ id: 'root', component: 'LingUI.Avatar', label: '小林', url: { path: '/url' } }],
      { url: 'javascript:alert(1)' },
    )
    expect(unsafe.querySelector('img')).toBeNull()
  })
  it('renders optional empty-state actions and validates their references', () => {
    expect(
      render([
        { id: 'root', component: 'LingUI.EmptyState', title: '暂无结果', child: 'action' },
        text('action', '调整筛选条件'),
      ]).textContent,
    ).toContain('调整筛选条件')
    expect(() =>
      validateDocument(
        definition('空状态', [
          { id: 'root', component: 'LingUI.EmptyState', title: '暂无结果', child: 'root' },
        ]),
      ),
    ).toThrow()
  })
  it.each(
    [
      [],
      [{ label: 'A', value: 0 }],
      [
        { label: 'A', value: -2 },
        { label: 'B', value: -2 },
      ],
      [
        { label: 'A', value: -1e12 },
        { label: 'B', value: 1e12 },
      ],
    ].map((data) => ({ data })),
  )('keeps line geometry finite for $data', ({ data }) => {
    const line = lineGeometry(data)
    expect(line.path).not.toMatch(/NaN|Infinity/)
    expect(
      line.points.every(
        (point) => point.x >= 24 && point.x <= 296 && point.y >= 20 && point.y <= 148,
      ),
    ).toBe(true)
  })
  it('handles zero and 100% donut series and exposes the values as readable text', () => {
    expect(donutGeometry([{ label: 'A', value: 0 }]).segments).toEqual([''])
    const full = donutGeometry([{ label: 'A', value: 100 }])
    expect(full.segments[0]!.match(/A72/g)).toHaveLength(2)
    const root = render([
      {
        id: 'root',
        component: 'LingUI.DonutChart',
        label: '分布',
        data: [
          { label: 'A', value: 0 },
          { label: 'B', value: 0 },
        ],
      },
    ])
    expect(root.textContent).toContain('暂无占比数据')
    expect(root.querySelectorAll('.lg-chart-legend li')).toHaveLength(2)
    expect(root.innerHTML).not.toMatch(/NaN|Infinity/)
  })
  it.each([
    { component: 'LingUI.Rating', label: '评分', value: { path: '/score' }, max: 11 },
    { component: 'LingUI.Skeleton', lines: 0 },
    { component: 'LingUI.DonutChart', label: '图表', data: [{ label: 'A', value: -1 }] },
    {
      component: 'LingUI.Select',
      label: '选择',
      value: { path: '/choice' },
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'a' },
      ],
    },
  ])('rejects invalid extension values %#', (node) => {
    expect(() =>
      validateDocument(definition('组件', [{ id: 'root', ...node } as ComponentNode])),
    ).toThrow()
  })
  it('preserves disabled select, charts and trusted links in static preview', async () => {
    const nodes: ComponentNode[] = [
      column('root', ['select', 'chart', 'link', 'avatar']),
      {
        id: 'select',
        component: 'LingUI.Select',
        label: '分类',
        value: { path: '/choice' },
        options: [
          { label: '甲', value: 'a' },
          { label: '乙', value: 'b' },
        ],
      },
      {
        id: 'chart',
        component: 'LingUI.LineChart',
        label: '变化',
        data: [
          { label: '第一天', value: -10 },
          { label: '第二天', value: 20 },
        ],
      },
      { id: 'link', component: 'LingUI.Link', text: '文档', url: 'https://example.com/docs' },
      { id: 'avatar', component: 'LingUI.Avatar', label: '林', url: '/avatar.png' },
    ]
    const fallback = await staticPreview(createInstance(definition('预览', nodes, { choice: 'b' })))
    const select = fallback.querySelector<HTMLButtonElement>('.lg-select-trigger')!
    expect(select.disabled).toBe(true)
    expect(select.textContent?.trim()).toBe('乙')
    expect(fallback.querySelector('.lg-select-panel')).toBeNull()
    expect(fallback.querySelectorAll('a[href]')).toHaveLength(1)
    expect(fallback.querySelector('a[href]')!.getAttribute('href')).toBe('https://example.com/docs')
    expect(fallback.querySelector('img')!.getAttribute('src')).toBe('/avatar.png')
    expect(fallback.querySelector('svg .lg-line-path')).not.toBeNull()
    expect(fallback.textContent).toContain('第一天')
    expect(fallback.querySelector('[onclick]')).toBeNull()
  })
  it('edits options while guarding duplicate values', async () => {
    const node: ComponentNode = {
      id: 'root',
      component: 'LingUI.Select',
      label: '分类',
      value: { path: '/choice' },
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    }
    view = mount(ChoiceProperties, { props: { node } })
    await view.findAll('.lu-table-editor-row')[1]!.findAll('input')[1]!.setValue('a')
    expect(view.find('[role=alert]').text()).toContain('不能')
    expect(view.emitted('update')).toBeUndefined()
    await view.findAll('.lu-table-editor-row')[1]!.findAll('input')[1]!.setValue('c')
    const next = view.emitted('update')!.at(-1)![0] as ComponentNode
    expect(next.options![1]!.value).toBe('c')
    expect(() => validateDocument(definition('分类', [next]))).not.toThrow()
  })
  it('edits negative line values and navigation layers through the inspector', async () => {
    const node: ComponentNode = {
      id: 'root',
      component: 'LingUI.LineChart',
      label: '变化',
      data: [{ label: 'A', value: 1 }],
    }
    view = mount(DesignProperties, { props: { node } })
    await view.get('input[type=number]').setValue(-5)
    await view.get('input[type=number]').trigger('change')
    expect((view.emitted('update')!.at(-1)![0] as ComponentNode).data![0]!.value).toBe(-5)
    view.unmount()
    view = mount(NavigationProperties, {
      props: {
        node: { id: 'root', component: 'LingUI.Breadcrumbs', items: [{ label: '首页' }] },
        state: {},
      },
    })
    await view
      .findAll('button')
      .find((button) => button.text() === '添加层级')!
      .trigger('click')
    expect((view.emitted('update')!.at(-1)![0] as ComponentNode).items).toHaveLength(2)
  })
})
