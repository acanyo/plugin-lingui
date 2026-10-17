import { resolveDocument as openuiSurface, serializeSource as openuiSource } from '@lingui/renderer'
import { afterEach, describe, expect, it } from 'vitest'
import {
  builtInThemes,
  createInstance,
  examples,
  mountRenderer,
  renderStatic,
  type ComponentNode,
  type Dynamic,
  type RendererHandle,
} from '@lingui/renderer'
import {
  column,
  document as definition,
  text,
} from '../../../packages/renderer/src/examples/builders'
const handles: RendererHandle[] = []
afterEach(async () => {
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  document.body.replaceChildren()
})
function render(example: string) {
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(
    mountRenderer(host, createInstance(examples.find((value) => value.id === example)!.create())),
  )
  return host.shadowRoot!
}
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
}
describe('registered Svelte renderer', () => {
  it('expands a callout and restores independent state', async () => {
    const first = render('notice'),
      second = render('notice')
    const detail = first.querySelector('details')!
    expect(detail.open).toBe(false)
    first.querySelector('summary')!.click()
    await settle()
    expect(detail.open).toBe(true)
    expect(second.querySelector('details')!.open).toBe(false)
  })
  it('supports single and multiple FAQ expansion', async () => {
    const root = render('faq')
    const details = root.querySelectorAll('details')
    expect(details[0]!.open).toBe(true)
    details[1]!.querySelector('summary')!.click()
    await settle()
    expect(details[0]!.open).toBe(false)
    expect(details[1]!.open).toBe(true)
    root.querySelector<HTMLButtonElement>('[role="switch"]')!.click()
    await settle()
    details[0]!.querySelector('summary')!.click()
    await settle()
    expect(details[0]!.open).toBe(true)
    expect(details[1]!.open).toBe(true)
  })
  it('submits and resets the knowledge quiz', async () => {
    const root = render('quiz')
    const submit = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '提交答案',
    )!
    expect(submit.disabled).toBe(true)
    expect(root.textContent).toContain('请先选择一个答案')
    submit.click()
    await settle()
    expect(root.textContent).not.toContain('回答正确')
    expect(root.textContent).not.toContain('再想一想')
    const heap = root.querySelector<HTMLInputElement>('input[value=heap]')!
    heap.checked = true
    heap.dispatchEvent(new Event('change', { bubbles: true }))
    await settle()
    expect(submit.disabled).toBe(false)
    ;[...root.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '提交答案')!
      .click()
    await settle()
    expect(root.textContent).toContain('回答正确')
    ;[...root.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '重新作答')!
      .click()
    await settle()
    expect(root.textContent).not.toContain('回答正确')
    expect(heap.checked).toBe(false)
    expect(submit.disabled).toBe(true)
    expect(root.textContent).toContain('请先选择一个答案')
  })
  it('updates calculator results with bounded input and reset', async () => {
    const root = render('calculator')
    const input = root.querySelector<HTMLInputElement>('input[type=number]')!
    expect(root.querySelector('h1')!.textContent).toBe('8')
    input.value = '900'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    expect(root.querySelector('h1')!.textContent).toBe('3')
    root.querySelector('button')!.click()
    await settle()
    expect(root.querySelector('h1')!.textContent).toBe('8')
  })
  it('expands diagram nodes and escapes arbitrary text', async () => {
    const root = render('architecture')
    expect(root.querySelector('.lg-diagram')!.textContent).not.toContain('年轻代')
    ;[...root.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('堆内存'))!
      .click()
    await settle()
    expect(root.querySelector('.lg-diagram')!.textContent).toContain('年轻代')
    const definition = examples[0]!.create()
    definition.parameters[0]!.default = '<img src=x onerror=alert(1)>'
    const host = document.createElement('div')
    document.body.append(host)
    handles.push(mountRenderer(host, createInstance(definition)))
    expect(host.shadowRoot!.querySelector('img')).toBeNull()
    expect(host.shadowRoot!.textContent).toContain('<img src=x onerror=alert(1)>')
  })
  it('keeps grouped architecture nodes interactive after switching direction and theme', async () => {
    const definition = examples.find((example) => example.id === 'architecture')!.create()
    const components = Object.values(openuiSurface(definition).nodes)
    components.find((node) => node.id === 'diagram')!.orientation = 'horizontal'
    components.find((node) => node.id === 'method')!.accent = true
    definition.source = openuiSource(components)
    const host = document.createElement('div')
    document.body.append(host)
    const instance = createInstance(definition)
    const handle = mountRenderer(host, instance)
    handles.push(handle)
    const root = host.shadowRoot!
    expect(root.querySelector('.lg-diagram-horizontal')).not.toBeNull()
    const group = root.querySelector('.lg-diagram-group')!
    const grid = group.querySelector('.lg-diagram-grid')!
    expect(
      [...grid.children].filter((child) => child.classList.contains('lg-diagram-item')),
    ).toHaveLength(4)
    const heap = group.querySelector<HTMLButtonElement>('button')!
    expect(heap.getAttribute('aria-expanded')).toBe('false')
    heap.click()
    await settle()
    expect(heap.getAttribute('aria-expanded')).toBe('true')
    expect(root.getElementById(heap.getAttribute('aria-controls')!)!.textContent).toContain(
      '年轻代',
    )
    handle.update({ ...instance, theme: builtInThemes.find((theme) => theme.id === 'graphite')! })
    await settle()
    expect(heap.getAttribute('aria-expanded')).toBe('true')
    expect(root.querySelector('.lingui-surface')!.getAttribute('data-mode')).toBe('dark')
    heap.click()
    await settle()
    expect(root.querySelector('.lg-diagram')!.textContent).not.toContain('年轻代')
    expect(root.querySelector('.lg-diagram-accent')!.textContent).toContain('方法区')
  })
  it('generates readable static HTML from Svelte without scripts', async () => {
    const html = await renderStatic(createInstance(examples[3]!.create()))
    expect(html).toContain('阅读时间计算器')
    expect(html).toContain('disabled')
    expect(html).not.toContain('<script')
    expect(html).toContain('lingui-surface')
    expect(html).toContain('lingui-container')
  })
  it.each(['Text', 'LingUI.DiagramNode', 'LingUI.TimelineItem', 'LingUI.Progress'] as const)(
    'contains a failed %s expression and recovers after reset',
    async (component) => {
      const value: Dynamic = {
        call: 'lingui.evaluate',
        args: { expression: { op: 'divide', args: [12, { path: '/denominator' }] } },
      }
      const result: ComponentNode =
        component === 'Text'
          ? text('result', value)
          : component === 'LingUI.Progress'
            ? { id: 'result', component, label: value, value }
            : { id: 'result', component, title: value }
      const nodes: ComponentNode[] = [
        column('root', ['input', 'container']),
        {
          id: 'input',
          component: 'LingUI.NumberInput',
          label: '除数',
          value: { path: '/denominator' },
        },
        {
          id: 'container',
          component:
            component === 'LingUI.DiagramNode'
              ? 'LingUI.Diagram'
              : component === 'LingUI.TimelineItem'
                ? 'LingUI.Timeline'
                : 'Column',
          children: ['result'],
        },
        result,
      ]
      const host = window.document.createElement('div')
      window.document.body.append(host)
      handles.push(
        mountRenderer(host, createInstance(definition('计算容错', nodes, { denominator: 1 }))),
      )
      const root = host.shadowRoot!
      const other = render('notice')
      expect(root.textContent).toContain('12')
      const input = root.querySelector<HTMLInputElement>('input')!
      input.value = '0'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await settle()
      expect(root.textContent).toContain('计算暂不可用')
      expect(root.textContent).not.toContain('NaN')
      expect(root.querySelector('[role=alert]')!.textContent).toContain('除数不能为零')
      expect(other.querySelector('[role=alert]')).toBeNull()
      root.querySelector<HTMLButtonElement>('.lg-error button')!.click()
      await settle()
      expect(root.querySelector('[role=alert]')).toBeNull()
      expect(root.textContent).toContain('12')
      expect(input.value).toBe('1')
    },
  )
  it('keeps failed conditions hidden without breaking the surrounding surface', async () => {
    const host = window.document.createElement('div')
    window.document.body.append(host)
    handles.push(
      mountRenderer(
        host,
        createInstance(
          definition('条件容错', [
            column('root', ['stable', 'conditional']),
            text('stable', '仍然可以阅读'),
            {
              id: 'conditional',
              component: 'LingUI.Conditional',
              child: 'hidden',
              condition: { op: 'divide', args: [1, 0] },
            },
            text('hidden', '此内容应隐藏'),
          ]),
        ),
      ),
    )
    await settle()
    expect(host.shadowRoot!.textContent).toContain('仍然可以阅读')
    expect(host.shadowRoot!.textContent).not.toContain('此内容应隐藏')
    expect(host.shadowRoot!.querySelector('[role=alert]')!.textContent).toContain('除数不能为零')
  })
})
