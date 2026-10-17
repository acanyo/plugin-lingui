import { resolveDocument as openuiSurface, serializeSource as openuiSource } from '@lingui/renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  componentNames,
  createInstance,
  dateInputValue,
  resolveDocument,
  mountRenderer,
  safeMediaUrl,
  validateDocument,
  type ComponentNode,
  type RendererHandle,
  type State,
} from '@lingui/renderer'
import {
  column,
  document as definition,
  dispatch,
  text,
} from '../../../packages/renderer/src/examples/builders'
import { addNode, createBlankDocument, removeNode } from '../component-studio/document-editor'
import { addTab, removeTab, renameTab } from '../component-studio/tabs-editor'
import MediaProperties from '../component-studio/MediaProperties.vue'
import { staticPreview } from './helpers/static-preview'
const handles: RendererHandle[] = []
const dialogDescriptors = new Map<string, PropertyDescriptor | undefined>()
let view: VueWrapper | undefined
afterEach(async () => {
  view?.unmount()
  view = undefined
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  vi.restoreAllMocks()
  for (const [name, descriptor] of dialogDescriptors) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
  dialogDescriptors.clear()
  document.body.replaceChildren()
})
function render(nodes: ComponentNode[], state: State = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(mountRenderer(host, createInstance(definition('基础组件', nodes, state))))
  return host.shadowRoot!
}
const missing = ['Image', 'Video', 'AudioPlayer', 'List', 'Tabs', 'Modal', 'DateTimeInput'] as const
describe('OpenUI basic component kinds', () => {
  it('registers the 18 core layout, input and media kinds', () => {
    const basics = [
      'Text',
      'Image',
      'Icon',
      'Video',
      'AudioPlayer',
      'Row',
      'Column',
      'List',
      'Card',
      'Tabs',
      'Modal',
      'Divider',
      'Button',
      'TextField',
      'CheckBox',
      'ChoicePicker',
      'Slider',
      'DateTimeInput',
    ]
    for (const name of basics) expect(componentNames).toContain(name)
  })
  it.each(missing)('creates valid, editable %s defaults', (type) => {
    const added = addNode(createBlankDocument(), 'root', type)
    expect(() => validateDocument(added.document)).not.toThrow()
    if (type === 'List')
      expect(() =>
        validateDocument(addNode(added.document, added.id, 'Text').document),
      ).not.toThrow()
    expect(() => validateDocument(removeNode(added.document, added.id))).not.toThrow()
  })
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg/>',
    'file:///tmp/a.png',
    '//example.com/a.png',
    '/\\example.com/a.png',
    'https://user:pass@example.com/a.png',
    'https://example.com/\na.png',
    'http://example.com/a.png',
  ])('rejects executable or unsupported media URL %s', (url) => {
    expect(safeMediaUrl(url)).toBeUndefined()
    expect(() =>
      validateDocument(definition('图片', [{ id: 'root', component: 'Image', url }])),
    ).toThrow()
  })
  it('allows safe sources and blocks unsafe URLs resolved from state', () => {
    expect(safeMediaUrl('https://example.com/photo.png')).toBe('https://example.com/photo.png')
    expect(safeMediaUrl('/upload/photo.png')).toBe('/upload/photo.png')
    const root = render(
      [{ id: 'root', component: 'Image', url: { path: '/url' }, description: '配图' }],
      { url: 'javascript:alert(1)' },
    )
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('添加图片资源')
  })
  it('renders images with safe attributes and falls back after a load failure', async () => {
    const root = render([
      {
        id: 'root',
        component: 'Image',
        url: '/upload/photo.png',
        description: '山间小路',
        fit: 'contain',
      },
    ])
    const image = root.querySelector('img')!
    expect(image.alt).toBe('山间小路')
    expect(image.getAttribute('crossorigin')).toBe('anonymous')
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer')
    image.dispatchEvent(new Event('error'))
    await flushPromises()
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('图片暂时无法加载')
  })
  it('renders media with native controls, no autoplay and no eager playback download', () => {
    const root = render([
      column('root', ['video', 'audio']),
      { id: 'video', component: 'Video', url: '/video.mp4' },
      { id: 'audio', component: 'AudioPlayer', url: '/audio.mp3', description: '声音笔记' },
    ])
    for (const media of root.querySelectorAll('video, audio')) {
      expect(media.hasAttribute('controls')).toBe(true)
      expect(media.getAttribute('preload')).toBe('none')
      expect(media.hasAttribute('autoplay')).toBe(false)
    }
  })
  it('switches optional-state Tabs with keyboard navigation and isolates instances', async () => {
    const nodes: ComponentNode[] = [
      {
        id: 'root',
        component: 'Tabs',
        tabs: [
          { title: { path: '/title' }, child: 'one' },
          { title: '第二页', child: 'two' },
        ],
      },
      text('one', '第一段'),
      text('two', '第二段'),
    ]
    const first = render(nodes, { title: '第一页' }),
      second = render(nodes, { title: '第一页' })
    const tabs = first.querySelectorAll<HTMLButtonElement>('[role=tab]')
    expect(tabs[0]!.textContent).toBe('第一页')
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await flushPromises()
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    expect(first.activeElement).toBe(tabs[1])
    expect(second.querySelector('[role=tab]')!.getAttribute('aria-selected')).toBe('true')
  })
  it('adds, renames and removes tab pages while preserving valid references', () => {
    const added = addNode(createBlankDocument(), 'root', 'Tabs')
    let document = addTab(added.document, added.id)
    document = renameTab(document, added.id, 1, '第二页')
    expect(resolveDocument(validateDocument(document)).nodes[added.id]!.tabs![1]!.title).toBe(
      '第二页',
    )
    document = removeTab(document, added.id, 1)
    expect(resolveDocument(validateDocument(document)).nodes[added.id]!.tabs).toHaveLength(1)
    expect(() => removeTab(document, added.id, 0)).toThrow()
  })
  it('binds date-time input to local state and respects bounds', async () => {
    const root = render(
      [
        column('root', ['date', 'value']),
        {
          id: 'date',
          component: 'DateTimeInput',
          enableDate: true,
          label: '日期',
          value: { path: '/date' },
          min: '2026-10-01',
          max: '2026-10-31',
        },
        text('value', { path: '/date' }),
      ],
      { date: '' },
    )
    const trigger = root.querySelector<HTMLButtonElement>('.lg-select-trigger')!
    trigger.click()
    await flushPromises()
    root.querySelector<HTMLButtonElement>('[data-date="2026-10-12"]')!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('2026-10-12')
    trigger.click()
    await flushPromises()
    const unavailable = root.querySelector<HTMLButtonElement>('[data-date="2026-11-01"]')!
    expect(unavailable.disabled).toBe(true)
    unavailable.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('2026-10-12')
    expect(dateInputValue('2026-02-30', true, false)).toBe('')
    expect(dateInputValue('25:00', false, true)).toBe('')
    expect(dateInputValue('2026-10-12T20:30', true, true)).toBe('2026-10-12T20:30')
  })
  it('validates date bounds, modal references and cycles', () => {
    const added = addNode(createBlankDocument(), 'root', 'DateTimeInput')
    const components = Object.values(openuiSurface(added.document).nodes)
    components.find((node) => node.id === added.id)!.min = '2026-02-30'
    added.document.source = openuiSource(components)
    expect(() => validateDocument(added.document)).toThrow()
    expect(() =>
      validateDocument(
        definition('弹窗', [
          { id: 'root', component: 'Modal', trigger: 'root', content: 'missing' },
        ]),
      ),
    ).toThrow()
  })
  it('opens a modal without dispatching the trigger action, closes and returns focus', async () => {
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
    const root = render(
      [
        column('root', ['modal', 'counter']),
        { id: 'modal', component: 'Modal', label: '详情', trigger: 'trigger', content: 'content' },
        {
          id: 'trigger',
          component: 'Button',
          child: 'trigger-label',
          action: dispatch({ type: 'increment', path: '/count' }),
        },
        text('trigger-label', '打开'),
        text('content', '弹窗正文'),
        text('counter', { path: '/count' }),
      ],
      { count: 0 },
    )
    const button = root.querySelector<HTMLButtonElement>('.lg-modal-trigger button')!
    button.focus()
    button.click()
    await flushPromises()
    const dialog = root.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(root.querySelector('.lg-column > .lg-text')!.textContent).toBe('0')
    const escaped = vi.fn()
    root.host.addEventListener('keyup', escaped)
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    dialog.querySelector('button')!.click()
    button.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, composed: true }),
    )
    expect(escaped).not.toHaveBeenCalled()
    await flushPromises()
    expect(dialog.open).toBe(false)
    expect(root.activeElement).toBe(button)
  })
  it('renders modal contents and media in the static preview', async () => {
    const added = addNode(createBlankDocument(), 'root', 'Modal')
    const next = addNode(added.document, 'root', 'Image')
    const components = Object.values(openuiSurface(next.document).nodes)
    components.find((node) => node.id === next.id)!.url = '/upload/photo.png'
    next.document.source = openuiSource(components)
    const fallback = await staticPreview(createInstance(next.document))
    expect(fallback.querySelector('details')!.textContent).toContain('在这里填写详细说明')
    expect(fallback.querySelector('dialog')).toBeNull()
    expect(fallback.querySelector('img[src]')!.getAttribute('src')).toBe('/upload/photo.png')
    expect(fallback.querySelector('[src*="injected"]')).toBeNull()
    expect(fallback.querySelector('script, [onerror]')).toBeNull()
  })
  it('edits media through the manual inspector', async () => {
    const added = addNode(createBlankDocument(), 'root', 'Image')
    const surface = resolveDocument(added.document)
    view = mount(MediaProperties, {
      props: { node: surface.nodes[added.id]!, state: surface.state },
    })
    await view.get('input[type=text]').setValue('/upload/new.png')
    await view.get('input[type=text]').trigger('change')
    expect(view.emitted('text')!.at(-1)).toEqual(['url', '/upload/new.png'])
  })
  it('supports multiline and obscured TextField variants', async () => {
    const root = render(
      [
        column('root', ['notes', 'secret', 'result']),
        {
          id: 'notes',
          component: 'TextField',
          variant: 'longText',
          label: '笔记',
          value: { path: '/notes' },
        },
        {
          id: 'secret',
          component: 'TextField',
          variant: 'obscured',
          label: '隐藏文本',
          value: { path: '/secret' },
        },
        text('result', { path: '/notes' }),
      ],
      { notes: '', secret: '' },
    )
    const area = root.querySelector('textarea')!
    area.value = '第一行\n第二行'
    area.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(root.querySelector('.lg-column > .lg-text')!.textContent).toBe('第一行\n第二行')
    expect(root.querySelector('input')!.type).toBe('password')
  })
})
