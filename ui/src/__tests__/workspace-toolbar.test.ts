import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import WorkspaceToolbar from '../workspace/WorkspaceToolbar.vue'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  document.body.replaceChildren()
})
function render() {
  view = mount(WorkspaceToolbar, {
    props: {
      title: '北京实时天气插件',
      status: '已保存 · v1',
      dirty: false,
      busy: false,
      operationBlock: '',
      canSave: true,
      savedVersion: 1,
      hasRevisions: true,
      canUndo: true,
      canRedo: false,
      undoReason: '',
      redoReason: '没有可重做的修改',
      externalDraftCount: 3,
    },
    attachTo: document.body,
  })
  return view
}
describe('workspace toolbar disclosure', () => {
  it('closes on selection and dispatches the original action without changing the project', async () => {
    const view = render()
    const menu = view.get('details').element as HTMLDetailsElement
    menu.open = true
    await view
      .findAll('button')
      .find((button) => button.text() === '外部 AI 草稿3')!
      .trigger('click')
    expect(menu.open).toBe(false)
    expect(view.emitted('action')).toEqual([['externalDrafts']])
    expect((view.get('[aria-label="组件名称"]').element as HTMLInputElement).value).toBe(
      '北京实时天气插件',
    )
    expect(view.get('summary .lu-workspace-pending').text()).toBe('3')
  })
  it('restores focus on Escape and closes when tabbing away', async () => {
    const view = render()
    const menu = view.get('details').element as HTMLDetailsElement
    menu.open = true
    const history = view.findAll('button').find((button) => button.text() === '创作历史')!
    ;(history.element as HTMLButtonElement).focus()
    await history.trigger('keydown', { key: 'Escape' })
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(view.get('summary').element)
    menu.open = true
    await history.trigger('focusout', { relatedTarget: view.get('.lu-workspace-save').element })
    expect(menu.open).toBe(false)
  })
  it('keeps busy and conflict guards on both compact and expanded controls', async () => {
    const view = render()
    await view.setProps({
      busy: true,
      operationBlock: 'AI 正在创作，请等待完成',
      undoReason: 'AI 正在创作，请等待完成',
      redoReason: 'AI 正在创作，请等待完成',
    })
    for (const button of view
      .findAll('button')
      .filter((button) =>
        ['新建对话', '撤销修改', '保存新版本'].includes(
          button.attributes('aria-label') ?? button.text(),
        ),
      )) {
      expect(button.attributes('disabled')).toBeDefined()
      expect(button.attributes('title')).toContain('AI 正在创作')
    }
    await view.setProps({ busy: false, operationBlock: '请先处理 AI 结果冲突', canSave: false })
    expect(view.find('.lu-workspace-save').exists()).toBe(false)
    expect(view.get('[aria-label="撤销修改"]').attributes('disabled')).toBeDefined()
    expect(
      view
        .findAll('button')
        .find((button) => button.text() === '创作历史')!
        .attributes('disabled'),
    ).toBeUndefined()
  })
  it('hides work-specific actions for an empty workspace', async () => {
    const view = render()
    await view.setProps({ title: undefined, hasRevisions: false, externalDraftCount: undefined })
    expect(view.find('[aria-label="组件名称"]').exists()).toBe(false)
    expect(view.find('.lu-workspace-save').exists()).toBe(false)
    expect(view.find('summary .lu-workspace-pending').exists()).toBe(false)
    expect(view.text()).not.toContain('导出与发布')
    expect(view.text()).not.toContain('作品版本')
    expect(view.text()).not.toContain('外部 AI 草稿')
  })
})
