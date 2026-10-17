import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import { Dialog } from '@halo-dev/components'
import { axiosInstance } from '@halo-dev/api-client'
import McpKeyIssueDialog from '../mcp/keys/McpKeyIssueDialog.vue'
import McpKeyPanel from '../mcp/keys/McpKeyPanel.vue'
import { createMcpKeyClient, keyStatus, keyWorkScope, type McpKeyClient } from '../mcp/keys/client'
import { clientConfiguration, EXTERNAL_MCP_PATH } from '../mcp/client'

let wrapper: VueWrapper | undefined
const endpoint = `https://halo.example${EXTERNAL_MCP_PATH}`
const issued = {
  token: 'lgu_mcp_test-secret',
  key: {
    id: 'id-1',
    name: 'Codex',
    expiresAt: '2099-01-01T00:00:00Z',
    prefix: 'lgu_mcp_test',
    workNames: [],
  },
}
function client(): McpKeyClient {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(issued),
    revoke: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    works: vi.fn().mockResolvedValue([
      { label: '天气', value: 'weather' },
      { label: '测验', value: 'quiz' },
    ]),
  }
}
const global = {
  plugins: [[formkit, defaultConfig()]] as [typeof formkit, ReturnType<typeof defaultConfig>][],
  stubs: { teleport: true, transition: false },
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
async function press(label: string) {
  const button = wrapper!.findAll('button').find((button) => button.text().trim() === label)
  expect(button, label).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}
async function setup(input = client()) {
  wrapper = mount(McpKeyIssueDialog, {
    props: { endpoint, client: input },
    global,
    attachTo: document.body,
  })
  await flushPromises()
  await wrapper.get('input[name="mcp-key-name"]').setValue('Codex')
  await vi.waitFor(() =>
    expect(wrapper!.get('.lu-key-submit').attributes('disabled')).toBeUndefined(),
  )
  await flushPromises()
  return input
}
async function submit() {
  await wrapper!.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper!.text()).toContain('密钥仅在这次显示'))
}
async function chooseScope(value: 'all' | 'selected') {
  await vi.waitFor(() =>
    expect(wrapper!.find(`input[name="mcp-key-work-scope"][value="${value}"]`).exists()).toBe(true),
  )
  await wrapper!.get(`input[name="mcp-key-work-scope"][value="${value}"]`).setValue(true)
  await vi.waitFor(() => expect(wrapper!.find('.lu-key-all-works').exists()).toBe(value === 'all'))
}
describe('MCP dedicated key workflow', () => {
  it('grants draft submission independently of project reads only when explicitly checked', async () => {
    const api = client()
    vi.mocked(api.create).mockResolvedValue({
      ...issued,
      key: { ...issued.key, submitDrafts: true },
    })
    await setup(api)
    await wrapper!.get('input[name="mcp-key-submit-drafts"]').setValue(true)
    await vi.waitFor(() =>
      expect(wrapper!.get('input[name="mcp-key-submit-drafts"]').element).toHaveProperty(
        'checked',
        true,
      ),
    )
    await flushPromises()
    await submit()
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ submitDrafts: true, allWorks: false, workNames: [] }),
    )
    expect(wrapper!.text()).toContain('已单独授权提交创作草稿')
  })
  it('defaults to no project permission, reveals once and never persists or includes keys in placeholder configuration', async () => {
    const api = await setup()
    const persist = vi.spyOn(Storage.prototype, 'setItem')
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await submit()
    expect(api.create).toHaveBeenCalledWith({
      name: 'Codex',
      expiresInDays: 30,
      workNames: [],
      allWorks: false,
      submitDrafts: false,
    })
    expect(api.works).not.toHaveBeenCalled()
    expect(wrapper!.get('[aria-label="新创建的 MCP 密钥"]').text()).toBe(issued.token)
    await press('复制 MCP 配置（含密钥）')
    const config = JSON.parse(writeText.mock.calls[0]![0])
    expect(config.mcpServers.lingui.headers['X-Lingui-MCP-Key']).toBe(issued.token)
    expect(config.mcpServers.lingui.url).toBe(endpoint)
    expect(clientConfiguration(endpoint)).toContain('<LINGUI_MCP_KEY>')
    expect(persist).not.toHaveBeenCalled()
    await press('已保存，关闭')
    expect(wrapper!.find('[aria-label="新创建的 MCP 密钥"]').exists()).toBe(false)
    expect(wrapper!.emitted('close')).toHaveLength(1)
  })
  it('only grants explicitly selected projects and clears them when optional access is disabled', async () => {
    const api = await setup()
    await wrapper!.get('input[name="mcp-key-grant"]').setValue(true)
    await vi.waitFor(() => expect(wrapper!.find('.lu-key-work-options').exists()).toBe(true))
    expect(
      wrapper!
        .findAll('input[name="mcp-key-works"]')
        .every((input) => !(input.element as HTMLInputElement).checked),
    ).toBe(true)
    const choice = wrapper!
      .findAll('input[type="checkbox"]')
      .find((input) => input.attributes('value') === 'weather')!
    await choice.setValue(true)
    await vi.waitFor(() => expect(wrapper!.text()).toContain('已选择 1'))
    await submit()
    expect(api.create).toHaveBeenCalledWith({
      name: 'Codex',
      expiresInDays: 30,
      workNames: ['weather'],
      allWorks: false,
      submitDrafts: false,
    })
  })
  it('grants all current and future projects even when the project picker cannot load', async () => {
    const api = client()
    vi.mocked(api.works).mockRejectedValue(new Error('项目列表暂时不可用'))
    vi.mocked(api.create).mockResolvedValue({ ...issued, key: { ...issued.key, allWorks: true } })
    await setup(api)
    await wrapper!.get('input[name="mcp-key-grant"]').setValue(true)
    await flushPromises()
    await chooseScope('all')
    await flushPromises()
    expect(wrapper!.find('.lu-key-work-options').exists()).toBe(false)
    expect(wrapper!.text()).toContain('包含以后新建的项目')
    expect(wrapper!.text()).not.toContain('项目列表暂时不可用')
    await submit()
    expect(api.create).toHaveBeenCalledWith({
      name: 'Codex',
      expiresInDays: 30,
      workNames: [],
      allWorks: true,
      submitDrafts: false,
    })
    expect(wrapper!.text()).toContain('全部项目 · 包含以后新建的项目')
  })
  it('can grant future projects before any projects exist', async () => {
    const api = client()
    vi.mocked(api.works).mockResolvedValue([])
    await setup(api)
    await wrapper!.get('input[name="mcp-key-grant"]').setValue(true)
    await flushPromises()
    await chooseScope('all')
    await submit()
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ allWorks: true, workNames: [] }),
    )
  })
  it('preserves selected projects when switching modes and clears authorization when disabled', async () => {
    const api = await setup()
    await wrapper!.get('input[name="mcp-key-grant"]').setValue(true)
    await vi.waitFor(() => expect(wrapper!.find('.lu-key-work-options').exists()).toBe(true))
    await wrapper!.get('input[name="mcp-key-works"][value="weather"]').setValue(true)
    await vi.waitFor(() => expect(wrapper!.text()).toContain('已选择 1'))
    await chooseScope('all')
    await chooseScope('selected')
    expect(wrapper!.get('input[name="mcp-key-works"][value="weather"]').element).toHaveProperty(
      'checked',
      true,
    )
    await chooseScope('all')
    await wrapper!.get('input[name="mcp-key-grant"]').setValue(false)
    await vi.waitFor(() => expect(wrapper!.find('.lu-key-work-picker').exists()).toBe(false))
    await submit()
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ allWorks: false, workNames: [] }),
    )
  })
  it('lists all-project grants distinctly without reinterpreting old keys', async () => {
    const api = client()
    vi.mocked(api.list).mockResolvedValue([{ ...issued.key, allWorks: true }])
    wrapper = mount(McpKeyPanel, { props: { endpoint, client: api }, global })
    await flushPromises()
    expect(wrapper.text()).toContain('全部项目 · 包含以后新建的项目')
    expect(keyWorkScope(issued.key)).toContain('未授权读取项目')
    expect(keyWorkScope({ ...issued.key, workNames: ['weather'] })).toBe('已授权 1 个项目')
  })
  it('displays API errors and allows retry without losing the form', async () => {
    const api = client()
    vi.mocked(api.create).mockRejectedValueOnce({ response: { status: 403 } })
    await setup(api)
    await wrapper!.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('当前账号没有此操作的权限'))
    expect(wrapper!.get('input[name="mcp-key-name"]').element).toHaveProperty('value', 'Codex')
    await submit()
    expect(api.create).toHaveBeenCalledTimes(2)
  })
  it('requires confirmation, revokes active keys and deletes stopped records', async () => {
    const api = client()
    vi.mocked(api.list)
      .mockResolvedValueOnce([issued.key])
      .mockResolvedValueOnce([{ ...issued.key, revoked: true }])
      .mockResolvedValueOnce([])
    let confirm: (() => Promise<void>) | undefined
    vi.spyOn(Dialog, 'warning').mockImplementation((options) => {
      confirm = options?.onConfirm as () => Promise<void>
    })
    wrapper = mount(McpKeyPanel, { props: { endpoint, client: api }, global })
    await flushPromises()
    await press('撤销')
    expect(api.revoke).not.toHaveBeenCalled()
    await confirm!()
    await flushPromises()
    expect(api.revoke).toHaveBeenCalledWith('id-1')
    expect(wrapper.text()).toContain('已撤销')
    await press('删除记录')
    await confirm!()
    await flushPromises()
    expect(api.delete).toHaveBeenCalledWith('id-1')
    expect(wrapper.text()).toContain('还没有接入密钥')
  })
  it('uses generated management API and preserves metadata-only list output', async () => {
    const get = vi
      .spyOn(axiosInstance, 'request')
      .mockResolvedValue({ data: { items: [issued.key] } })
    const result = await createMcpKeyClient().list()
    expect(result).toEqual([issued.key])
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/apis/console.api.lingui.acanyo.com/v1alpha1/mcpkeys' }),
    )
    expect(keyStatus({ ...issued.key, expiresAt: '2020-01-01T00:00:00Z' })).toBe('已过期')
  })
})
