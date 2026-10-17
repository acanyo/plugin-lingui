import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance, examples, mountRenderer, type RendererHandle } from '@lingui/renderer'
import ContentProperties from '../component-studio/ContentProperties.vue'
import { staticPreview } from './helpers/static-preview'
const handles: RendererHandle[] = []
const views: VueWrapper[] = []
afterEach(async () => {
  views.splice(0).forEach((view) => view.unmount())
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  document.body.replaceChildren()
})
function render(id: string) {
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(
    mountRenderer(host, createInstance(examples.find((example) => example.id === id)!.create())),
  )
  return host.shadowRoot!
}
async function click(root: ShadowRoot, label: string) {
  ;[...root.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === label)!
    .click()
  await flushPromises()
}
describe('built-in article components', () => {
  it('updates checklist progress and resets without affecting another instance', async () => {
    const root = render('checklist'),
      other = render('checklist')
    for (const input of root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
      input.checked = true
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    await flushPromises()
    expect(root.querySelector('progress')!.value).toBe(100)
    expect(root.textContent).toContain('全部检查完成')
    expect(other.querySelector('progress')!.value).toBe(0)
    await click(root, '重新检查')
    expect(root.querySelector('progress')!.value).toBe(0)
    expect(root.textContent).not.toContain('全部检查完成')
  })
  it('reveals and hides a flashcard answer', async () => {
    const root = render('flashcard')
    expect(root.textContent).not.toContain('每个请求都是独立的')
    await click(root, '查看答案')
    expect(root.textContent).toContain('每个请求都是独立的')
    await click(root, '收起答案')
    expect(root.textContent).not.toContain('每个请求都是独立的')
  })
  it('navigates tutorial steps and glossary tabs using the keyboard', async () => {
    const root = render('steps')
    expect(root.textContent).toContain('明确读者的问题')
    await click(root, '下一步')
    expect(root.textContent).toContain('用合适的结构表达')
    await click(root, '下一步')
    expect(root.textContent).toContain('预览并分享')
    expect(
      [...root.querySelectorAll('button')].find((button) => button.textContent === '下一步')!
        .disabled,
    ).toBe(true)
    const glossary = render('glossary')
    glossary
      .querySelector('[role=tab]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await flushPromises()
    expect(glossary.querySelector('[role=tab][aria-selected=true]')!.textContent).toBe('异步')
    expect(glossary.querySelector('[role=tabpanel]:not([hidden])')!.textContent).toContain(
      '等待时继续做其他事',
    )
  })
  it('recalculates budget and temperature from bounded inputs', async () => {
    const budget = render('budget'),
      converter = render('converter')
    const input = budget.querySelector<HTMLInputElement>('input[type=range]')!
    input.value = '5'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const temperature = converter.querySelector<HTMLInputElement>('input[type=number]')!
    temperature.value = '0'
    temperature.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(budget.querySelector('.lg-metric-value')!.textContent).toBe('2350')
    expect(converter.querySelector('.lg-metric-value')!.textContent).toBe('32')
  })
  it.each(['comparison', 'quote', 'statistics'])(
    'preserves readable %s content in the static preview',
    async (id) => {
      const definition = examples.find((example) => example.id === id)!.create()
      const fallback = await staticPreview(createInstance(definition))
      expect(fallback.textContent).toContain(
        id === 'comparison' ? '熟悉开发流程' : id === 'quote' ? '好的交互' : '180',
      )
      if (id === 'comparison') expect(fallback.querySelectorAll('th[scope=col]')).toHaveLength(3)
      if (id === 'quote') expect(fallback.querySelector('blockquote')).not.toBeNull()
      expect(fallback.querySelector('script')).toBeNull()
    },
  )
  it('keeps table cells aligned when adding and removing a column', async () => {
    const view = mount(ContentProperties, {
      props: {
        node: {
          id: 'table',
          component: 'LingUI.Table',
          label: '比较',
          columns: ['维度', '甲', '乙'],
          rows: [{ label: '价格', cells: ['10', '20'] }],
        },
      },
    })
    views.push(view)
    await view
      .findAll('button')
      .find((button) => button.text() === '添加方案列')!
      .trigger('click')
    const added = view.emitted('update')!.at(-1)![0] as typeof view.vm.$props.node
    expect(added.columns).toHaveLength(4)
    expect(added.rows![0]!.cells).toHaveLength(3)
    await view.setProps({ node: added })
    await view.get('button[aria-label="移除第 2 列"]').trigger('click')
    const removed = view.emitted('update')!.at(-1)![0] as typeof added
    expect(removed.rows![0]!.cells).toEqual(['20', '内容'])
  })
})
