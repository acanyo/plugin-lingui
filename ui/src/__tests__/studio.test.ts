import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  builtInThemes,
  createInstance,
  examples,
  resolveDocument,
  type ComponentInstance,
} from '@lingui/renderer'
import ComponentStudio from '../component-studio/ComponentStudio.vue'
import { createBlankDocument } from '../component-studio/document-editor'
import { repositoryKey } from '../services/repository'
import { createLocalRepository } from '../dev/local-repository'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.replaceChildren()
})
function studio(instance: ComponentInstance) {
  wrapper = mount(ComponentStudio, {
    attachTo: document.body,
    global: { provide: { [repositoryKey as symbol]: createLocalRepository() } },
    props: {
      instance,
      themes: builtInThemes,
      onUpdate: (value) => {
        void wrapper!.setProps({ instance: value })
      },
    },
  })
  return wrapper
}
function button(text: string) {
  return wrapper!.findAll('button').find((item) => item.text() === text)!
}
function surface() {
  return wrapper!.element
    .querySelector('.lingui-renderer-host')!
    .shadowRoot!.querySelector('.lingui-surface')!
}

describe('Vue studio and Svelte rendering boundary', () => {
  it('creates editable UI from an empty composition and previews the same data', async () => {
    const view = studio(createInstance(createBlankDocument()))
    await view.get('select[aria-label="要添加的组件类型"]').setValue('Text')
    await button('＋ 添加组件').trigger('click')
    await flushPromises()
    await view.get('.lu-properties textarea').setValue('作者自由添加的内容')
    await view.get('.lu-properties textarea').trigger('change')
    await flushPromises()
    const instance = (view.props() as { instance: ComponentInstance }).instance
    expect(Object.keys(resolveDocument(instance.document).nodes)).toHaveLength(2)
    expect(surface().textContent).toContain('作者自由添加的内容')
  })
  it('preserves article parameter overrides through structural and theme edits', async () => {
    const instance = createInstance(examples[0]!.create())
    instance.parameters.title = '当前文章的标题'
    const view = studio(instance)
    await view.get('select[aria-label="要添加的组件类型"]').setValue('Text')
    await button('＋ 添加组件').trigger('click')
    await flushPromises()
    expect(surface().textContent).toContain('当前文章的标题')
    await button('参数').trigger('click')
    const title = view.get('.lu-instance-parameters input[type=text]')
    await title.setValue('修改后的文章标题')
    await title.trigger('change')
    await flushPromises()
    await view.get('select[aria-label="预览主题"]').setValue('graphite')
    await flushPromises()
    expect((view.props() as { instance: ComponentInstance }).instance.parameters.title).toBe(
      '修改后的文章标题',
    )
    expect(surface().textContent).toContain('修改后的文章标题')
    expect(
      (view.props() as { instance: ComponentInstance }).instance.document.parameters[0]!.default,
    ).not.toBe('修改后的文章标题')
  })
})
