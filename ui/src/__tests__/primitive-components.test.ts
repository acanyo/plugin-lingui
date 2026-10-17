import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  createInstance,
  resolveDocument,
  mountRenderer,
  pureTheme,
  validateDocument,
  type ComponentNode,
  type ComponentName,
  type LinguiDocument,
  type RendererHandle,
} from '@lingui/renderer'
import {
  column,
  document as definition,
  text,
} from '../../../packages/renderer/src/examples/builders'
import {
  addNode,
  createBlankDocument,
  removeNode,
  updateNode,
} from '../component-studio/document-editor'
import { reparentNode } from '../component-studio/reparent-editor'
import { createCatalogPreview } from '../component-studio/catalog-preview'
import { staticPreview } from './helpers/static-preview'
import PrimitiveProperties from '../component-studio/PrimitiveProperties.vue'

const kinds: ComponentName[] = [
  'LingUI.Box',
  'LingUI.Center',
  'LingUI.Spacer',
  'LingUI.Separator',
  'LingUI.FormGroup',
  'LingUI.ButtonGroup',
  'LingUI.IconButton',
  'LingUI.Popover',
  'LingUI.InlineCode',
  'LingUI.Highlight',
]
let handle: RendererHandle | undefined, view: VueWrapper | undefined
afterEach(async () => {
  view?.unmount()
  view = undefined
  await handle?.destroy()
  handle = undefined
  document.body.replaceChildren()
})
function render(document: LinguiDocument) {
  const host = window.document.createElement('div')
  window.document.body.append(host)
  handle = mountRenderer(host, createInstance(document))
  return host.shadowRoot!
}
const action = {
  functionCall: {
    call: 'lingui.dispatch' as const,
    args: { actions: [{ type: 'increment' as const, path: '/count' }] },
  },
}

describe('composable primitives', () => {
  it.each(kinds)('supports %s with the same editing, preview and article paths', async (kind) => {
    const instance = createCatalogPreview(kind)
    validateDocument(instance.document)
    const root = render(instance.document)
    await flushPromises()
    expect(root.querySelector('.lg-error')).toBeNull()
    const fallback = await staticPreview(instance)
    expect(fallback.textContent).not.toContain('暂时无法恢复')
    if (kind === 'LingUI.Highlight')
      expect(fallback.querySelector('mark')?.textContent).toBe('值得关注的内容')
    if (kind === 'LingUI.Popover')
      expect(fallback.querySelector('.lg-popover-static')?.hasAttribute('hidden')).toBe(false)
  })
  it('combines layout, field and text primitives without losing nodes when reparenting', () => {
    const box = addNode(createBlankDocument(), 'root', 'LingUI.Box')
    const group = addNode(box.document, box.id, 'LingUI.FormGroup')
    const content = resolveDocument(group.document).nodes[group.id]!.child!
    const code = addNode(group.document, content, 'LingUI.InlineCode')
    const moved = reparentNode(code.document, code.id, box.id)
    const surface = resolveDocument(validateDocument(moved))
    expect(surface.nodes[box.id]!.children).toContain(code.id)
    expect(surface.nodes[content]!.children).not.toContain(code.id)
    expect(() => removeNode(moved, content)).toThrow('唯一内容')
    expect(resolveDocument(removeNode(moved, group.id)).nodes[content]).toBeUndefined()
  })
  it('dispatches labeled icon actions, updates bound text and honors disabled state', async () => {
    const button: ComponentNode = {
      id: 'icon',
      component: 'LingUI.IconButton',
      label: '增加一次',
      name: 'arrow',
      action,
    }
    const doc = definition(
      '图标动作',
      [column('root', ['icon', 'count']), button, text('count', { path: '/count' })],
      { count: 0 },
    )
    const root = render(doc)
    const control = root.querySelector<HTMLButtonElement>('button')!
    expect(control.getAttribute('aria-label')).toBe('增加一次')
    control.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')?.textContent).toBe('1')
    handle!.update(createInstance(updateNode(doc, { ...button, disabled: true })))
    await flushPromises()
    root.querySelector<HTMLButtonElement>('button')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')?.textContent).toBe('0')
  })
  it('propagates disabled semantics to fields and buttons in a form group', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.FormGroup')
    const node = resolveDocument(added.document).nodes[added.id]!
    const icon = addNode(added.document, node.child!, 'LingUI.IconButton')
    const root = render(updateNode(icon.document, { ...node, disabled: true }))
    await flushPromises()
    expect(root.querySelector('fieldset')?.getAttribute('aria-describedby')).toBeTruthy()
    expect([...root.querySelectorAll('input,button')].every((el) => el.matches(':disabled'))).toBe(
      true,
    )
  })
  it('disables nested summary controls through the form group without disabling a sibling', async () => {
    const group = addNode(createBlankDocument(), 'root', 'LingUI.FormGroup')
    const outer = resolveDocument(group.document).nodes[group.id]!
    const nested = addNode(group.document, outer.child!, 'LingUI.FormGroup')
    const inner = resolveDocument(nested.document).nodes[nested.id]!
    let document = nested.document
    for (const kind of ['LingUI.Combobox', 'LingUI.MultiSelect'] as const)
      document = addNode(document, inner.child!, kind).document
    document = addNode(document, 'root', 'LingUI.Combobox').document
    const root = render(updateNode(document, { ...outer, disabled: true }))
    await flushPromises()
    const triggers = root.querySelectorAll<HTMLButtonElement>('.lg-select-trigger')
    for (const trigger of [triggers[0]!, triggers[1]!]) {
      expect(trigger.disabled).toBe(true)
      trigger.click()
    }
    triggers[2]!.click()
    await flushPromises()
    expect(
      [...root.querySelectorAll<HTMLDivElement>('.lg-floating-panel')].map((el) => el.hidden),
    ).toEqual([true, true, false])
    handle!.update(createInstance(document))
    await flushPromises()
    expect(root.querySelector<HTMLButtonElement>('.lg-select-trigger')!.disabled).toBe(false)
  })
  it('opens arbitrary popover content without running the trigger action, and consumes Escape', async () => {
    const popover = addNode(createBlankDocument(), 'root', 'LingUI.Popover')
    const node = resolveDocument(popover.document).nodes[popover.id]!
    const input = addNode(popover.document, 'root', 'TextField')
    const root = render(input.document)
    const field = root.querySelector<HTMLInputElement>('input')!
    field.value = '保留输入'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    const trigger = root.querySelector<HTMLButtonElement>('.lg-popover-trigger button')!
    trigger.focus()
    trigger.click()
    await flushPromises()
    const panel = root.querySelector<HTMLElement>('.lg-popover-panel')!
    expect(panel.hidden).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(field.value).toBe('保留输入')
    const escaped: string[] = []
    const hostEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') escaped.push(event.type)
    }
    document.addEventListener('keydown', hostEscape)
    document.addEventListener('keyup', hostEscape)
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    panel.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(panel.hidden).toBe(true)
    expect(root.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, composed: true }),
    )
    document.removeEventListener('keydown', hostEscape)
    document.removeEventListener('keyup', hostEscape)
    expect(escaped).toEqual([])
    trigger.click()
    await flushPromises()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(panel.hidden).toBe(true)
  })
  it('supports an icon popover trigger while respecting its disabled state', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.Popover')
    const node = resolveDocument(added.document).nodes[added.id]!
    const icon: ComponentNode = {
      id: node.trigger!,
      component: 'LingUI.IconButton',
      label: '查看内容',
      name: 'help',
      action,
      disabled: true,
    }
    const root = render(updateNode(added.document, icon))
    root.querySelector<HTMLButtonElement>('.lg-popover-trigger button')!.click()
    await flushPromises()
    expect(root.querySelector<HTMLElement>('.lg-popover-panel')!.hidden).toBe(true)
  })
  it('preserves custom themes, keeps text escaped and renders non-modal fallback content', async () => {
    let doc = addNode(createBlankDocument(), 'root', 'LingUI.Popover').document
    const mark = addNode(doc, 'root', 'LingUI.Highlight')
    doc = updateNode(mark.document, {
      id: mark.id,
      component: 'LingUI.Highlight',
      text: '<img src=x onerror=alert(1)>',
      tone: 'danger',
    })
    const instance = createInstance(doc)
    instance.theme = { ...pureTheme, radius: 0, font: 'mono', spacing: 24 }
    const host = document.createElement('div')
    document.body.append(host)
    handle = mountRenderer(host, instance)
    await flushPromises()
    expect(host.shadowRoot!.querySelector('img')).toBeNull()
    const fallback = await staticPreview(instance)
    expect(fallback.querySelector('mark')?.textContent).toContain('<img')
    expect(fallback.querySelector('.lg-popover-content')?.textContent).toContain('这里可以组合')
    expect(fallback.querySelector('.lg-popover-panel')?.hasAttribute('popover')).toBe(false)
    expect(fallback.querySelector('.lingui-surface')?.getAttribute('style')).toContain(
      '--lingui-radius: 0px',
    )
  })
  it.each([
    { id: 'root', component: 'LingUI.Center', child: 'text', maxWidth: 999 },
    { id: 'root', component: 'LingUI.Box', children: ['text'], padding: '999px' },
    { id: 'root', component: 'LingUI.Spacer', size: 'massive' },
    { id: 'root', component: 'LingUI.Highlight', text: '文本', html: '<script>' },
    { id: 'root', component: 'LingUI.Popover', label: '浮层', trigger: 'text', content: 'text' },
    { id: 'root', component: 'LingUI.Popover', label: '浮层', trigger: 'text', content: 'content' },
    { id: 'root', component: 'LingUI.IconButton', label: '操作', name: 'arbitrary', action },
  ])('rejects unknown presentation or invalid references %#', (node) => {
    expect(() =>
      validateDocument(
        definition('校验', [node as ComponentNode, text('text', '文字'), text('content', '内容')]),
      ),
    ).toThrow()
  })
  it('writes bounded layout options as numbers and scales', async () => {
    view = mount(PrimitiveProperties, {
      props: { node: { id: 'center', component: 'LingUI.Center', child: 'body' } },
    })
    await view.get('[aria-label="最大内容宽度"]').setValue('320')
    expect(view.emitted('update')![0]![0]).toMatchObject({ maxWidth: 320 })
    await view.setProps({ node: { id: 'box', component: 'LingUI.Box', children: [] } })
    await view.get('[aria-label="内边距"]').setValue('none')
    expect(view.emitted('update')!.at(-1)![0]).toMatchObject({ padding: 'none' })
  })
})
