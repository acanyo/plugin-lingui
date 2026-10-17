import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { resolveDocument, type ComponentNode } from '@lingui/renderer'
import { column, document, text } from '../../../packages/renderer/src/examples/builders'
import EventEditor from '../component-studio/EventEditor.vue'
import MenuProperties from '../component-studio/MenuProperties.vue'

const button: ComponentNode = { id: 'save', component: 'Button', child: 'label' }
const doc = document('事件配置', [column('root', ['save']), button, text('label', '保存')], {})
function editor(node = button) {
  return mount(EventEditor, { props: { node, document: doc }, attachTo: window.document.body })
}
describe('visual event configuration', () => {
  it('shares a click request with startup, updates both and can return to manual loading', async () => {
    const wrapper = editor()
    try {
      await wrapper.get('button').trigger('click')
      await wrapper
        .get('input[placeholder^="/api/example"]')
        .setValue('https://example.com/weather')
      await wrapper.get('input[type="checkbox"]').setValue(true)
      const save = () =>
        wrapper
          .findAll('button')
          .find((button) => button.text() === '保存事件配置')!
          .trigger('click')
      await save()
      const first = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
      expect(first.events?.mount).toEqual(first.events?.click)
      expect(first.events?.mount).not.toBe(first.events?.click)
      await wrapper.setProps({ node: first })
      await wrapper
        .get('input[placeholder^="/api/example"]')
        .setValue('https://example.com/weather?v=2')
      await save()
      const changed = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
      expect(changed.events?.mount?.actions[0]).toMatchObject({
        url: 'https://example.com/weather?v=2',
      })
      await wrapper.setProps({ node: changed })
      await wrapper.get('input[type="checkbox"]').setValue(false)
      await save()
      const manual = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
      expect(manual.events?.mount).toBeUndefined()
      expect(manual.events?.click).toEqual(changed.events?.click)
    } finally {
      wrapper.unmount()
    }
  })
  it('preserves independently configured startup when editing or removing a click event', async () => {
    const startup = { actions: [{ type: 'emit' as const, name: 'work.opened' }] }
    const wrapper = editor({
      ...button,
      events: {
        mount: startup,
        click: { actions: [{ type: 'request', url: 'https://example.com/weather' }] },
      },
    })
    try {
      expect(wrapper.text()).toContain('已单独配置自动执行')
      expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '保存事件配置')!
        .trigger('click')
      expect((wrapper.emitted('update')!.at(-1)![0] as ComponentNode).events?.mount).toEqual(
        startup,
      )
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '移除事件')!
        .trigger('click')
      expect((wrapper.emitted('update')!.at(-1)![0] as ComponentNode).events).toEqual({
        mount: startup,
      })
    } finally {
      wrapper.unmount()
    }
  })
  it('configures automatic loading directly on a root container without a refresh button', async () => {
    const wrapper = editor(resolveDocument(doc).nodes.root!)
    try {
      expect(wrapper.get<HTMLSelectElement>('select[aria-label="触发事件"]').element.value).toBe(
        'mount',
      )
      expect(wrapper.text()).toContain('无需添加按钮')
      await wrapper.get('button').trigger('click')
      await wrapper
        .get('input[placeholder^="/api/example"]')
        .setValue('https://example.com/weather')
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '保存事件配置')!
        .trigger('click')
      const saved = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
      expect(saved.events?.mount?.actions[0]).toMatchObject({
        type: 'request',
        url: 'https://example.com/weather',
      })
      expect(saved.events?.click).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })
  it('can edit callback-only confirmation and menu components without a legacy action', () => {
    for (const node of [
      { id: 'confirm', component: 'LingUI.Popconfirm', label: '确认', text: '继续？' },
      {
        id: 'menu',
        component: 'LingUI.Dropdown',
        label: '操作',
        menuItems: [{ id: 'send', label: '提交' }],
      },
    ] as ComponentNode[]) {
      const wrapper = mount(MenuProperties, { props: { node } })
      expect(wrapper.text()).toContain('接入 API 或 JS 回调')
      wrapper.unmount()
    }
  })
  it('creates and saves an API action, then removes only its configured event', async () => {
    const wrapper = editor()
    try {
      await wrapper.get('button').trigger('click')
      await wrapper.get('input[placeholder^="/api/example"]').setValue('https://example.com/items')
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '保存事件配置')!
        .trigger('click')
      const saved = wrapper.emitted('update')![0]![0] as ComponentNode
      expect(saved.events?.click?.actions[0]).toMatchObject({
        type: 'request',
        url: 'https://example.com/items',
      })
      const next = {
        ...saved,
        events: {
          ...saved.events,
          focus: { actions: [{ type: 'emit' as const, name: 'focused' }] },
        },
      }
      await wrapper.setProps({ node: next })
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '移除事件')!
        .trigger('click')
      const removed = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
      expect(removed.events?.click).toBeUndefined()
      expect(removed.events?.focus).toBeDefined()
      expect(resolveDocument(doc).nodes.save).toEqual(button)
    } finally {
      wrapper.unmount()
    }
  })
  it('blocks saving malformed parameter JSON instead of silently keeping its previous value', async () => {
    const wrapper = editor()
    try {
      await wrapper.get('button').trigger('click')
      await wrapper.get('input[placeholder^="/api/example"]').setValue('https://example.com/items')
      const query = wrapper.get('textarea')
      await query.setValue('{"q":')
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '保存事件配置')!
        .trigger('click')
      expect(wrapper.emitted('update')).toBeUndefined()
      expect(wrapper.text()).toContain('参数需要有效 JSON')
      await query.setValue('{"q":{"$state":"/query"}}')
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '保存事件配置')!
        .trigger('click')
      expect(wrapper.emitted('update')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })
  it('validates the full JSON editor and limits events to the selected component capabilities', async () => {
    const wrapper = editor()
    try {
      expect(wrapper.get('select[aria-label="触发事件"]').text()).toContain('点击')
      expect(wrapper.get('select[aria-label="触发事件"]').text()).not.toContain('表单提交')
      await wrapper.get('button').trigger('click')
      await wrapper
        .get('textarea[aria-label="事件 JSON"]')
        .setValue('{"actions":[{"type":"callback","name":"onSave","code":"alert(1)"}]}')
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '应用事件 JSON')!
        .trigger('click')
      expect(wrapper.emitted('update')).toBeUndefined()
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
