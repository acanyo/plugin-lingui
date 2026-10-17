import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createInstance } from '@lingui/renderer'
import { document as definition, text } from '../../../packages/renderer/src/examples/builders'
import EmbedCodeDialog from '../component-embed/EmbedCodeDialog.vue'
import { embedClientKey, type EmbedClient } from '../component-embed/client'
import { repositoryKey } from '../services/repository'
import { createLocalRepository } from '../dev/local-repository'

const permission = vi.hoisted(() => ({ manage: true }))
vi.mock('../services/studio-access', () => ({
  useStudioAccess: () => ({ allows: () => permission.manage }),
}))
let view: VueWrapper | undefined
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  view?.unmount()
  document.body.replaceChildren()
  permission.manage = true
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})
function render(enabled = false, failStatus = false) {
  const client: EmbedClient = {
    status: vi.fn(async () => {
      if (failStatus) throw new Error('连接暂时中断')
      return { name: 'weather', enabled, revision: 2 }
    }),
    enable: vi.fn(async () => ({ name: 'weather', enabled: true, revision: 2 })),
    disable: vi.fn(async () => ({ name: 'weather', enabled: false, revision: 2 })),
  }
  const clipboard = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboard },
  })
  view = mount(EmbedCodeDialog, {
    props: {
      instance: {
        ...createInstance(definition('天气', [text('root', '天气')])),
        templateId: 'weather',
        templateVersion: 1,
      },
    },
    attachTo: document.body,
    global: {
      stubs: { transition: false },
      provide: {
        [repositoryKey as symbol]: { ...createLocalRepository(), mode: 'halo' },
        [embedClientKey as symbol]: client,
      },
    },
  })
  return { client, clipboard }
}
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent?.trim() === label,
  )!
}
function code() {
  return document.querySelector<HTMLTextAreaElement>('[aria-label="组件嵌入代码"]')!.value
}

describe('short embed publishing controls', () => {
  it('defaults to one short tag, does not publish on open, and copies without extra scripts', async () => {
    const { client, clipboard } = render(true)
    await flushPromises()
    expect(code()).toBe('<lingui-component data-lingui="weather"></lingui-component>')
    expect(client.enable).not.toHaveBeenCalled()
    button('复制嵌入代码').click()
    await flushPromises()
    expect(clipboard).toHaveBeenCalledWith(code())
    expect(client.enable).not.toHaveBeenCalled()
  })
  it('requires an explicit public action before copying and can revoke the same tag', async () => {
    const { client, clipboard } = render()
    await flushPromises()
    expect(client.enable).not.toHaveBeenCalled()
    button('开启公开嵌入并复制').click()
    await flushPromises()
    expect(client.enable).toHaveBeenCalledTimes(1)
    expect(clipboard).toHaveBeenCalledWith(code())
    expect(document.body.textContent).toContain('最新保存 v2')
    button('关闭公开嵌入').click()
    await flushPromises()
    expect(client.disable).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).not.toContain('已复制，可粘贴到主题中。')
    expect(button('开启公开嵌入并复制')).toBeDefined()
  })
  it('prevents readers from enabling private projects without a snapshot bypass', async () => {
    permission.manage = false
    const { client } = render()
    await flushPromises()
    expect(button('开启公开嵌入并复制').disabled).toBe(true)
    expect(document.body.textContent).toContain('请联系拥有组件管理权限的管理员开启')
    expect(button('独立快照')).toBeUndefined()
    expect(client.enable).not.toHaveBeenCalled()
  })
  it('blocks copy if status loading fails and supports checking again', async () => {
    const { client } = render(false, true)
    await flushPromises()
    expect(document.body.textContent).toContain('连接暂时中断')
    expect(button('复制嵌入代码').disabled).toBe(true)
    vi.mocked(client.status).mockResolvedValueOnce({ name: 'weather', enabled: true, revision: 3 })
    button('重新检查').click()
    await flushPromises()
    expect(document.body.textContent).toContain('最新保存 v3')
    expect(document.body.textContent).not.toContain('连接暂时中断')
    expect(client.enable).not.toHaveBeenCalled()
  })
})
