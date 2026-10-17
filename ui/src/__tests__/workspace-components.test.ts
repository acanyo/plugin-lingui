import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  createInstance,
  resolveDocument,
  mountRenderer,
  pureTheme,
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
import {
  monthCells,
  shiftMonth,
} from '../../../packages/renderer/src/renderer-core/inputs/calendar'
import {
  scatterGeometry,
  waterfallGeometry,
} from '../../../packages/renderer/src/renderer-core/charts/workspace'
import { addNode, createBlankDocument, removeNode } from '../component-studio/document-editor'
import { reparentNode } from '../component-studio/reparent-editor'
import { staticPreview } from './helpers/static-preview'
import TreeProperties from '../component-studio/TreeProperties.vue'
import WorkspaceProperties from '../component-studio/WorkspaceProperties.vue'
import ScatterProperties from '../component-studio/ScatterProperties.vue'

const kinds = [
  'TreeView',
  'Calendar',
  'CardChoice',
  'CheckboxGroup',
  'Drawer',
  'SplitPane',
  'ChatMessage',
  'Kanban',
  'ScatterChart',
  'WaterfallChart',
] as const
let handle: RendererHandle | undefined, view: VueWrapper | undefined
const dialogDescriptors = new Map<string, PropertyDescriptor | undefined>()
afterEach(async () => {
  view?.unmount()
  view = undefined
  await handle?.destroy()
  handle = undefined
  vi.restoreAllMocks()
  for (const [name, descriptor] of dialogDescriptors) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
  dialogDescriptors.clear()
  document.body.replaceChildren()
})
function defaults(kind: (typeof kinds)[number]) {
  return addNode(createBlankDocument(), 'root', `LingUI.${kind}`)
}
function render(nodes: ComponentNode[], state: State = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  handle = mountRenderer(host, createInstance(definition('工作区组件', nodes, state)))
  return host.shadowRoot!
}
function change(element: HTMLInputElement | HTMLSelectElement, value: string, event = 'change') {
  element.value = value
  element.dispatchEvent(new Event(event, { bubbles: true }))
}
function key(element: Element, key: string) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))
}

describe('workspace components', () => {
  it.each(kinds)('supports editing, rendering and static preview for %s', async (kind) => {
    const added = defaults(kind),
      instance = createInstance(validateDocument(added.document))
    const host = document.createElement('div')
    document.body.append(host)
    handle = mountRenderer(host, instance)
    await flushPromises()
    expect(host.shadowRoot!.querySelector('.lg-error')).toBeNull()
    expect(
      host.shadowRoot!.querySelector('.lingui-surface')!.textContent!.trim().length,
    ).toBeGreaterThan(0)
    const fallback = await staticPreview(instance)
    expect(fallback.textContent).not.toContain('暂时无法恢复')
    expect(fallback.textContent!.trim().length).toBeGreaterThan(0)
  })
  it('selects one card and multiple checkboxes with isolated runtime state', async () => {
    let document = defaults('CardChoice').document
    document = addNode(document, 'root', 'LingUI.CheckboxGroup').document
    const surface = resolveDocument(document),
      root = render(Object.values(surface.nodes), surface.state)
    root.querySelectorAll<HTMLInputElement>('input[type=radio]')[1]!.click()
    root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1]!.click()
    await flushPromises()
    expect(
      [...root.querySelectorAll<HTMLInputElement>('input[type=radio]')].map(
        (input) => input.checked,
      ),
    ).toEqual([false, true, false])
    expect(
      [...root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].map(
        (input) => input.checked,
      ),
    ).toEqual([true, true, false])
    expect(resolveDocument(document).state).toEqual(surface.state)
  })
  it('honors disabled selection, calendar and board controls', async () => {
    let document = createBlankDocument()
    for (const kind of ['CardChoice', 'CheckboxGroup', 'TreeView', 'Calendar', 'Kanban'] as const)
      document = addNode(document, 'root', `LingUI.${kind}`).document
    const surface = resolveDocument(document)
    for (const node of Object.values(surface.nodes))
      if (node.component !== 'Column') node.disabled = true
    const root = render(Object.values(surface.nodes), surface.state)
    expect(
      [
        ...root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>(
          'input, button, select',
        ),
      ].every((control) => control.disabled),
    ).toBe(true)
  })
  it('navigates and collapses trees with arrows and selects with Enter', async () => {
    const added = defaults('TreeView'),
      surface = resolveDocument(added.document),
      root = render(Object.values(surface.nodes), surface.state)
    const overview = root.querySelector<HTMLButtonElement>('[data-tree-id=overview]')!
    overview.focus()
    key(overview, 'ArrowDown')
    await flushPromises()
    const guide = root.querySelector<HTMLButtonElement>('[data-tree-id=guide]')!
    expect(root.activeElement).toBe(guide)
    key(guide, 'ArrowLeft')
    await flushPromises()
    expect(guide.getAttribute('aria-expanded')).toBe('false')
    expect(root.querySelector('[data-tree-id=structure]')).toBeNull()
    key(guide, 'ArrowRight')
    await flushPromises()
    expect(guide.getAttribute('aria-expanded')).toBe('true')
    key(guide, 'ArrowRight')
    await flushPromises()
    const child = root.querySelector<HTMLButtonElement>('[data-tree-id=structure]')!
    expect(root.activeElement).toBe(child)
    child.click()
    await flushPromises()
    expect(child.getAttribute('aria-selected')).toBe('true')
    key(child, 'ArrowLeft')
    await flushPromises()
    expect(root.activeElement).toBe(guide)
  })
  it('renders leap days and month boundaries without local timezone conversion', () => {
    expect(monthCells('2024-02').some((day) => day.date === '2024-02-29')).toBe(true)
    expect(monthCells('2025-02').some((day) => day.date === '2025-02-29')).toBe(false)
    expect(monthCells('0001-01').find((day) => day.inMonth)?.date).toBe('0001-01-01')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('0001-01', -1)).toBe('0001-01')
    expect(shiftMonth('9999-12', 1)).toBe('9999-12')
  })
  it('moves calendar focus across months and selects dates independently', async () => {
    const added = defaults('Calendar'),
      surface = resolveDocument(added.document),
      root = render(Object.values(surface.nodes), surface.state)
    const selected = root.querySelector<HTMLButtonElement>('[data-date="2026-10-13"]')!
    selected.focus()
    key(selected, 'PageDown')
    await flushPromises()
    expect(root.activeElement?.getAttribute('data-date')).toBe('2026-11-13')
    expect(root.querySelector('.lg-calendar > .lg-caption')!.textContent).toContain('2026-10-13')
    ;(root.activeElement as HTMLButtonElement).click()
    await flushPromises()
    expect(root.querySelector('.lg-calendar > .lg-caption')!.textContent).toContain('2026-11-13')
    expect(
      root
        .querySelector<HTMLButtonElement>('[data-date="2026-11-13"]')!
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })
  it('updates split ratios, preserves theme state and protects both child regions', async () => {
    const added = defaults('SplitPane'),
      instance = createInstance(added.document),
      host = document.createElement('div')
    document.body.append(host)
    handle = mountRenderer(host, instance)
    const slider = host.shadowRoot!.querySelector<HTMLInputElement>('input[type=range]')!
    change(slider, '65', 'input')
    await flushPromises()
    handle.update({ ...instance, theme: { ...pureTheme, radius: 0, font: 'mono' } })
    await flushPromises()
    expect(host.shadowRoot!.querySelector<HTMLInputElement>('input[type=range]')!.value).toBe('65')
    const node = resolveDocument(added.document).nodes[added.id]!
    expect(() => removeNode(added.document, node.children![0]!)).toThrow('两个')
    expect(() => reparentNode(added.document, node.children![0]!, 'root')).toThrow('两个')
    const fallback = await staticPreview(instance)
    expect(fallback.querySelector('.lg-split-static')).not.toBeNull()
    expect(fallback.textContent).toContain('左侧')
    expect(fallback.textContent).toContain('右侧')
  })
  it('moves tasks, ignores unknown initial columns and resets without editing the definition', async () => {
    const added = defaults('Kanban'),
      surface = resolveDocument(added.document),
      root = render(Object.values(surface.nodes), surface.state)
    const selector = root.querySelector<HTMLSelectElement>('[aria-label="移动「梳理内容提纲」"]')!
    change(selector, 'done')
    await flushPromises()
    expect(root.querySelector('[aria-label=已完成]')!.textContent).toContain('梳理内容提纲')
    expect(root.querySelector('[aria-label=待开始]')!.textContent).not.toContain('梳理内容提纲')
    expect(resolveDocument(added.document).state).toEqual(surface.state)
  })
  it('opens a drawer without resetting unrelated inputs and restores focus on close', async () => {
    for (const name of ['showModal', 'close'])
      dialogDescriptors.set(
        name,
        Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name),
      )
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false
        this.dispatchEvent(new Event('close'))
      },
    })
    const drawer = defaults('Drawer'),
      input = addNode(drawer.document, 'root', 'TextField'),
      surface = resolveDocument(input.document),
      root = render(Object.values(surface.nodes), surface.state)
    const field = root.querySelector<HTMLInputElement>('input')!
    change(field, '保留输入', 'input')
    const trigger = root.querySelector<HTMLButtonElement>('.lg-modal-trigger button')!
    trigger.focus()
    trigger.click()
    await flushPromises()
    expect(root.querySelector<HTMLDialogElement>('dialog')!.open).toBe(true)
    expect(field.value).toBe('保留输入')
    root.querySelector<HTMLButtonElement>('[aria-label=关闭抽屉]')!.click()
    await flushPromises()
    expect(root.activeElement).toBe(trigger)
    const fallback = await staticPreview(createInstance(input.document))
    expect(fallback.querySelector('details')!.textContent).toContain('在侧边查看')
  })
  it('keeps negative, zero and single-point chart coordinates finite and sums deltas', () => {
    const scatter = scatterGeometry([
      { label: 'a', x: -1e12, y: 0 },
      { label: 'b', x: 1e12, y: 1e12 },
    ])
    expect(
      scatter.points.every((point) => Number.isFinite(point.cx) && Number.isFinite(point.cy)),
    ).toBe(true)
    const waterfall = waterfallGeometry([
      { label: 'a', value: 40 },
      { label: 'b', value: -60 },
      { label: 'c', value: 5 },
    ])
    expect(waterfall.total).toBe(-15)
    expect(
      waterfall.steps.every((step) => Number.isFinite(step.y) && Number.isFinite(step.height)),
    ).toBe(true)
    expect(scatterGeometry([{ label: 'a', x: 0, y: 0 }]).points[0]!.cx).toBe(40)
    expect(
      waterfallGeometry([{ label: 'a', value: 0 }]).steps.every((step) => Number.isFinite(step.y)),
    ).toBe(true)
  })
  it('sanitizes message text and keeps scatter data and waterfall totals readable', async () => {
    let document = defaults('ChatMessage').document
    const surface = resolveDocument(document)
    const message = Object.values(surface.nodes).find(
      (node) => node.component === 'LingUI.ChatMessage',
    )!
    message.text = '<img src=x onerror=alert(1)>'
    const root = render(Object.values(surface.nodes), surface.state)
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('<img')
    document = addNode(document, 'root', 'LingUI.ScatterChart').document
    document = addNode(document, 'root', 'LingUI.WaterfallChart').document
    const fallback = await staticPreview(createInstance(document))
    expect(fallback.querySelector('table')!.textContent).toContain('记录 A')
    expect(fallback.textContent).toContain('60')
  })
  it.each([
    { component: 'LingUI.Calendar', month: '0000-01', label: '日历', value: { path: '/v' } },
    {
      component: 'LingUI.TreeView',
      label: '树',
      value: { path: '/v' },
      treeItems: [{ id: 'a', label: '甲', parent: 'a' }],
    },
    {
      component: 'LingUI.TreeView',
      label: '树',
      value: { path: '/v' },
      treeItems: [{ id: 'a', label: '甲', parent: 'missing' }],
    },
    {
      component: 'LingUI.TreeView',
      label: '树',
      value: { path: '/v' },
      treeItems: [
        { id: 'a', label: '甲' },
        { id: 'a', label: '乙' },
      ],
    },
    {
      component: 'LingUI.TreeView',
      label: '树',
      value: { path: '/v' },
      treeItems: [{ id: 'constructor', label: '甲' }],
    },
    { component: 'LingUI.SplitPane', label: '分栏', value: { path: '/v' }, children: ['a', 'a'] },
    {
      component: 'LingUI.Kanban',
      label: '看板',
      value: { path: '/v' },
      boards: [
        { id: 'a', title: '甲', cards: [{ id: 'a', title: '任务' }] },
        { id: 'b', title: '乙', cards: [] },
      ],
    },
  ])('rejects ambiguous or invalid structures %#', (node) => {
    expect(() =>
      validateDocument(
        definition('校验', [{ id: 'root', ...node } as ComponentNode, text('a', '内容')]),
      ),
    ).toThrow()
  })
  it('rejects cycles and excessive depth in the tree editor without losing the current draft', async () => {
    const added = defaults('TreeView'),
      surface = resolveDocument(added.document)
    view = mount(TreeProperties, {
      props: { node: surface.nodes[added.id]!, document: added.document, state: surface.state },
    })
    await view.findAll('select')[1]!.setValue('structure')
    expect(view.get('[role=alert]').text()).toContain('循环')
    expect(view.emitted('document')).toBeUndefined()
    const items = Array.from({ length: 9 }, (_, index) => ({
      id: `item-${index}`,
      label: `${index}`,
      ...(index ? { parent: `item-${index - 1}` } : {}),
    }))
    expect(() =>
      validateDocument(
        definition('树', [
          {
            id: 'root',
            component: 'LingUI.TreeView',
            label: '树',
            value: { path: '/v' },
            treeItems: items,
          },
        ]),
      ),
    ).toThrow('8 层')
  })
  it('validates manual calendar dates and rejects invalid scatter numbers', async () => {
    const added = defaults('Calendar'),
      surface = resolveDocument(added.document)
    view = mount(WorkspaceProperties, {
      props: { node: surface.nodes[added.id]!, document: added.document, state: surface.state },
    })
    await view.get('[aria-label=初始日期]').setValue('2026-12-08')
    expect(resolveDocument(view.emitted('document')![0]![0] as never).state.fields).toMatchObject({
      [added.id]: '2026-12-08',
    })
    view.unmount()
    const scatter = defaults('ScatterChart')
    view = mount(ScatterProperties, {
      props: { node: resolveDocument(scatter.document).nodes[scatter.id]! },
    })
    await view.find('input[type=number]').setValue('10000000000000')
    expect(view.get('[role=alert]').text()).toContain('1 万亿')
    expect(view.emitted('update')).toBeUndefined()
  })
})
