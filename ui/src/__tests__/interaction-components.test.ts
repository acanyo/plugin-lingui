import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  createInstance,
  mountRenderer,
  renderStatic,
  resolveDocument,
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
import { addNode, createBlankDocument, removeNode } from '../component-studio/document-editor'
import { createCatalogPreview } from '../component-studio/catalog-preview'
import DynamicInputProperties from '../component-studio/DynamicInputProperties.vue'
import MenuProperties from '../component-studio/MenuProperties.vue'
import ControlProperties from '../component-studio/ControlProperties.vue'
const handles: RendererHandle[] = []
let view: VueWrapper | undefined
const kinds = [
  'LingUI.Dropdown',
  'LingUI.Popconfirm',
  'LingUI.Cascader',
  'LingUI.TreeSelect',
  'LingUI.DynamicInput',
] as const
const tree = [
  { id: 'root-item', label: '分类' },
  { id: 'leaf', label: '叶子', parent: 'root-item' },
  { id: 'locked', label: '禁用分支', disabled: true },
  { id: 'locked-leaf', label: '不可选', parent: 'locked' },
]
function render(node: ComponentNode, state: State = {}, resultPath = '/value') {
  const instance = createInstance(
    definition(
      '交互细节',
      [column('root', [node.id, 'result']), node, text('result', { path: resultPath })],
      state,
    ),
  )
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(mountRenderer(host, instance))
  return { root: host.shadowRoot!, instance }
}
async function key(element: HTMLElement, key: string) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
  )
  await flushPromises()
}
function click(root: ShadowRoot, selector: string) {
  root.querySelector<HTMLButtonElement>(selector)!.click()
}
afterEach(async () => {
  view?.unmount()
  view = undefined
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  document.body.replaceChildren()
})

describe('composable interaction primitives', () => {
  it.each(kinds)('adds, validates, previews and removes %s', (kind) => {
    const added = addNode(createBlankDocument(), 'root', kind)
    expect(() => validateDocument(added.document)).not.toThrow()
    expect(() => createCatalogPreview(kind)).not.toThrow()
    expect(Object.keys(resolveDocument(removeNode(added.document, added.id)).nodes)).toEqual([
      'root',
    ])
  })
  it('runs only the selected menu action, skips disabled items and restores focus', async () => {
    const { root } = render(
      {
        id: 'menu',
        component: 'LingUI.Dropdown',
        label: '操作',
        menuItems: [
          {
            id: 'first',
            label: '第一项',
            action: dispatch({ type: 'setState', path: '/value', value: 'first' }),
          },
          {
            id: 'disabled',
            label: '禁用',
            disabled: true,
            action: dispatch({ type: 'setState', path: '/value', value: 'bad' }),
          },
          {
            id: 'last',
            label: '最后一项',
            action: dispatch({ type: 'setState', path: '/value', value: 'last' }),
          },
        ],
      },
      { value: 'initial' },
    )
    const trigger = root.querySelector<HTMLButtonElement>('[aria-haspopup=menu]')!
    trigger.click()
    await flushPromises()
    const items = root.querySelectorAll<HTMLButtonElement>('[role=menuitem]')
    expect(root.activeElement).toBe(items[0])
    items[1]!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('initial')
    await key(items[0]!, 'ArrowDown')
    expect(root.activeElement).toBe(items[2])
    items[2]!.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('last')
    expect(root.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
  it('does not confirm on cancellation, Escape or outside pointer; confirmation executes once', async () => {
    const { root } = render(
      {
        id: 'confirm',
        component: 'LingUI.Popconfirm',
        label: '删除',
        text: '确定删除吗？',
        tone: 'danger',
        action: dispatch({ type: 'increment', path: '/value' }),
      },
      { value: 0 },
    )
    const trigger = root.querySelector<HTMLButtonElement>('[aria-haspopup=dialog]')!
    trigger.click()
    await flushPromises()
    const cancel = root.querySelector<HTMLButtonElement>('[data-cancel]')!
    expect(root.activeElement).toBe(cancel)
    cancel.click()
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('0')
    trigger.click()
    await flushPromises()
    await key(cancel, 'Escape')
    expect(root.querySelector('.lg-text')!.textContent).toBe('0')
    expect(root.activeElement).toBe(trigger)
    trigger.click()
    await flushPromises()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }))
    await flushPromises()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.click()
    await flushPromises()
    click(root, '.lg-confirm-actions .lg-button-primary')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('1')
  })
  it('cascades without submitting parent nodes and disables entire branches', async () => {
    const { root } = render(
      {
        id: 'cascade',
        component: 'LingUI.Cascader',
        label: '分类',
        value: { path: '/value' },
        treeItems: tree,
      },
      { value: '' },
    )
    click(root, '.lg-select-trigger')
    await flushPromises()
    click(root, '[data-tree-id="root-item"]')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('')
    expect(root.querySelectorAll('.lg-cascader-column')).toHaveLength(2)
    expect(root.querySelector<HTMLButtonElement>('[data-tree-id=locked]')!.disabled).toBe(true)
    click(root, '[data-tree-id=leaf]')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('leaf')
    expect(root.querySelector('.lg-select-trigger')!.textContent).toContain('分类 / 叶子')
  })
  it('searches tree descendants, selects a parent and clears the binding', async () => {
    const { root } = render(
      {
        id: 'tree',
        component: 'LingUI.TreeSelect',
        label: '节点',
        value: { path: '/value' },
        treeItems: tree,
      },
      { value: '' },
    )
    click(root, '.lg-select-trigger')
    await flushPromises()
    const search = root.querySelector<HTMLInputElement>('input[type=search]')!
    search.value = '叶子'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(root.querySelectorAll('[role=treeitem]')).toHaveLength(1)
    click(root, '[data-tree-id=leaf]')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('leaf')
    click(root, '.lg-select-trigger')
    await flushPromises()
    click(root, '[data-tree-id=root-item]')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('root-item')
    click(root, '.lg-select-trigger')
    await flushPromises()
    click(root, '.lg-panel-footer button')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('')
  })
  it('supports hierarchical ArrowRight and ArrowLeft navigation', async () => {
    const { root } = render(
      {
        id: 'tree',
        component: 'LingUI.TreeSelect',
        label: '节点',
        value: { path: '/value' },
        treeItems: tree,
      },
      { value: '' },
    )
    click(root, '.lg-select-trigger')
    await flushPromises()
    const parent = root.querySelector<HTMLButtonElement>('[data-tree-id=root-item]')!
    await key(parent, 'ArrowRight')
    expect(root.activeElement?.getAttribute('data-tree-id')).toBe('leaf')
    await key(root.activeElement as HTMLElement, 'ArrowLeft')
    expect(root.activeElement).toBe(parent)
  })
  it('edits, reorders and removes repeatable rows while guarding both bounds', async () => {
    const { root } = render(
      {
        id: 'repeat',
        component: 'LingUI.DynamicInput',
        label: '条目',
        value: { path: '/value' },
        fields: [{ key: 'name', label: '名称' }],
        minRows: 1,
        maxRows: 2,
      },
      { value: [{ name: 'First' }, { name: 'Second' }] },
      '/value/0/name',
    )
    expect(root.querySelector<HTMLButtonElement>('.lg-dynamic-add')!.disabled).toBe(true)
    click(root, '[aria-label="上移第 2 行"]')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('Second')
    const input = root.querySelector<HTMLInputElement>('input')!
    input.value = 'Edited'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('Edited')
    click(root, '[aria-label="移除第 2 行"]')
    await flushPromises()
    expect(root.querySelector<HTMLButtonElement>('[aria-label="移除第 1 行"]')!.disabled).toBe(true)
    click(root, '.lg-dynamic-add')
    await flushPromises()
    expect(root.querySelectorAll('.lg-dynamic-row')).toHaveLength(2)
    expect(root.activeElement).toBe(root.querySelector('[data-dynamic-row="1"] input'))
  })
  it.each(kinds)('propagates group disable to %s without mutation', async (kind) => {
    const added = addNode(createBlankDocument(), 'root', kind),
      surface = resolveDocument(added.document),
      node = surface.nodes[added.id]!
    const root = render({ ...node, disabled: true }, surface.state).root
    const trigger = root.querySelector<HTMLButtonElement>('button')!
    expect(trigger.disabled).toBe(true)
    trigger.click()
    await flushPromises()
    expect(root.querySelector('[aria-expanded=true]')).toBeNull()
  })
  it.each(['LingUI.Cascader', 'LingUI.TreeSelect'] as const)(
    'guards hierarchy cycles and missing parents in %s',
    (component) => {
      const node: ComponentNode = {
        id: 'root',
        component,
        label: '节点',
        value: { path: '/value' },
        treeItems: [
          { id: 'a', label: 'A', parent: 'b' },
          { id: 'b', label: 'B', parent: 'a' },
        ],
      }
      expect(() => validateDocument(definition('树', [node]))).toThrow('循环')
      node.treeItems = [{ id: 'a', label: 'A', parent: 'missing' }]
      expect(() => validateDocument(definition('树', [node]))).toThrow('父级')
    },
  )
  it('rejects duplicate menu IDs, malformed nested action paths and missing values', () => {
    const item = {
      id: 'same',
      label: '操作',
      action: dispatch({ type: 'setState', path: '/value', value: '' }),
    }
    const node: ComponentNode = {
      id: 'root',
      component: 'LingUI.Dropdown',
      label: '菜单',
      menuItems: [item, item],
    }
    expect(() => validateDocument(definition('菜单', [node]))).toThrow('重复')
    for (const action of [
      dispatch({ type: 'setState', path: '/', value: '' }),
      dispatch({ type: 'setState', path: '/value' }),
      dispatch({ type: 'setState', path: '/constructor/value', value: '' }),
    ]) {
      node.menuItems = [{ ...item, action }]
      expect(() => validateDocument(definition('菜单', [node]))).toThrow()
    }
  })
  it('rejects unsafe or duplicate dynamic fields and inconsistent row limits', () => {
    const node: ComponentNode = {
      id: 'root',
      component: 'LingUI.DynamicInput',
      label: '条目',
      value: { path: '/value' },
      fields: [{ key: 'constructor', label: '字段' }],
    }
    expect(() => validateDocument(definition('动态', [node]))).toThrow('安全')
    node.fields = [
      { key: 'name', label: '一' },
      { key: 'name', label: '二' },
    ]
    expect(() => validateDocument(definition('动态', [node]))).toThrow('唯一')
    node.fields = [{ key: 'name', label: '名称' }]
    node.minRows = 3
    node.maxRows = 2
    expect(() => validateDocument(definition('动态', [node]))).toThrow('行数')
  })
  it.each(kinds)('removes nonfunctional %s overlays from article fallback', async (kind) => {
    const html = await renderStatic(createCatalogPreview(kind))
    const fallback = document.createElement('div')
    fallback.innerHTML = html
    expect(fallback.querySelector('.lg-floating-panel')).toBeNull()
    expect(fallback.querySelector('[aria-controls],[aria-expanded],[aria-haspopup]')).toBeNull()
    expect(
      [...fallback.querySelectorAll('button,input')].every((input) =>
        input.hasAttribute('disabled'),
      ),
    ).toBe(true)
  })
})

describe('precise control states and editors', () => {
  it('blocks loading/disabled button actions, preserves size and sets accessible busy state', async () => {
    const instance = createInstance(
      definition(
        '按钮',
        [
          column('root', ['button', 'result']),
          {
            id: 'button',
            component: 'Button',
            child: 'button-text',
            size: 'small',
            loading: { path: '/loading' },
            action: dispatch({ type: 'increment', path: '/value' }),
          },
          text('button-text', '保存'),
          text('result', { path: '/value' }),
        ],
        { value: 0, loading: true },
      ),
    )
    const host = document.createElement('div')
    document.body.append(host)
    handles.push(mountRenderer(host, instance))
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>('.lg-button')!
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.classList.contains('lg-size-small')).toBe(true)
    button.click()
    await flushPromises()
    expect(host.shadowRoot!.querySelectorAll('.lg-text')[1]!.textContent).toBe('0')
  })
  it('supports field affixes, clear/count/status and refuses readonly mutation', async () => {
    const node: ComponentNode = {
      id: 'input',
      component: 'TextField',
      label: '名称',
      value: { path: '/value' },
      prefixText: '@',
      suffixText: '标签',
      showCount: true,
      maxLength: 8,
      status: 'error',
      hint: '请输入名称',
      clearable: true,
    }
    const { root } = render(node, { value: 'hello' })
    expect(root.querySelector('.lg-input-count')!.textContent).toBe('5 / 8')
    expect(root.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    click(root, '.lg-input-clear')
    await flushPromises()
    expect(root.querySelector('.lg-text')!.textContent).toBe('')
    const other = render({ ...node, readOnly: true }, { value: 'fixed' }).root
    const input = other.querySelector<HTMLInputElement>('input')!
    input.value = 'attempt'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(other.querySelector('.lg-text')!.textContent).toBe('fixed')
    expect(other.querySelector('.lg-input-clear')).toBeNull()
  })
  it.each(['LingUI.Select', 'LingUI.Combobox', 'LingUI.MultiSelect'] as const)(
    'skips disabled grouped options in %s',
    async (component) => {
      const { root } = render(
        {
          id: 'picker',
          component,
          label: '分类',
          value: { path: '/value' },
          options: [
            { label: '禁用', value: 'bad', disabled: true, group: '分组' },
            { label: '可用', value: 'good', group: '分组', description: '辅助说明' },
          ],
        },
        { value: component === 'LingUI.MultiSelect' ? [] : '' },
      )
      click(root, '.lg-select-trigger')
      await flushPromises()
      const unavailable = root.querySelector<HTMLButtonElement>('[role=option]:disabled')!
      expect(unavailable.textContent).toContain('禁用')
      unavailable.click()
      await flushPromises()
      expect(root.querySelector('[aria-selected=true]')?.textContent ?? '').not.toContain('禁用')
      expect(root.querySelectorAll('.lg-option-group')).toHaveLength(1)
      expect(root.querySelector('small')!.textContent).toBe('辅助说明')
    },
  )
  it('edits new button states without overriding its bound loading flag', async () => {
    view = mount(ControlProperties, {
      props: {
        node: {
          id: 'button',
          component: 'Button',
          child: 'label',
          loading: { path: '/loading' },
          action: dispatch({ type: 'reset' }),
        },
      },
    })
    expect(view.text()).not.toContain('加载中')
    await view.find('select').setValue('small')
    expect(view.emitted('update')![0]![0]).toMatchObject({
      size: 'small',
      loading: { path: '/loading' },
    })
  })
  it('renames dynamic fields while preserving stored row values and guards unsafe names', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.DynamicInput'),
      surface = resolveDocument(added.document),
      node = surface.nodes[added.id]!
    view = mount(DynamicInputProperties, {
      props: { node, document: added.document, state: surface.state },
    })
    const identifier = view.findAll('.lu-table-editor-row')[0]!.find('input')
    await identifier.setValue('constructor')
    expect(view.find('[role=alert]').text()).toContain('安全')
    expect(view.emitted('document')).toBeUndefined()
    await identifier.setValue('title')
    const next = view.emitted('document')![0]![0] as typeof added.document
    expect(resolveDocument(next).nodes[node.id]!.fields![0]!.key).toBe('title')
    expect((resolveDocument(next).state.fields as State)[node.id]).toEqual([
      { title: '第一项', value: '可继续添加或调整顺序' },
    ])
  })
  it('edits menu actions through structured controls', async () => {
    const added = addNode(createBlankDocument(), 'root', 'LingUI.Dropdown'),
      node = resolveDocument(added.document).nodes[added.id]!
    view = mount(MenuProperties, { props: { node } })
    await view.find('input').setValue('我的操作')
    expect((view.emitted('update')![0]![0] as ComponentNode).menuItems![0]!.label).toBe('我的操作')
  })
})
