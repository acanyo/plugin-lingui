import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { axiosInstance } from '@halo-dev/api-client'
import { utils } from '@halo-dev/ui-shared'
import McpManagementView from '../mcp/McpManagementView.vue'
import StudioNavigation from '../workspace/StudioNavigation.vue'
import {
  createMcpClient,
  MCP_PATH,
  EXTERNAL_MCP_PATH,
  MCP_VERSION,
  type McpClient,
  type McpTool,
} from '../mcp/client'
import { createHaloRepository } from '../services/halo-repository'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'

let wrapper: VueWrapper | undefined
const previous = utils.permission.getUserPermissions()
afterEach(() => {
  wrapper?.unmount()
  utils.permission.setUserPermissions(previous ?? [])
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const tools: McpTool[] = [
  { name: 'search_components', description: '搜索全部组件', inputSchema: { type: 'object' } },
  { name: 'get_current_work', description: '获取已保存作品', inputSchema: { type: 'object' } },
]
function setup(mode: 'local' | 'halo' = 'halo', permissions = ['*']) {
  utils.permission.setUserPermissions(permissions)
  const client: McpClient = {
    initialize: vi.fn().mockResolvedValue({
      protocolVersion: MCP_VERSION,
      serverInfo: { name: 'lingui-creation', version: '1.0.0' },
    }),
    inspect: vi.fn().mockResolvedValue({ tools, skill: '# 规则\n用户风格优先' }),
    call: vi.fn().mockResolvedValue({ content: [], structuredContent: { total: 105 } }),
  }
  wrapper = mount(McpManagementView, {
    props: { mode, client },
    global: {
      stubs: { McpKeyPanel: true },
      provide: {
        [repositoryKey as symbol]:
          mode === 'halo' ? createHaloRepository() : createLocalRepository(),
      },
    },
  })
  return client
}
async function press(label: string) {
  const button = wrapper!.findAll('button').find((entry) => entry.text().trim() === label)
  expect(button, label).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}

describe('MCP management', () => {
  it('provides a navigation entry', async () => {
    wrapper = mount(StudioNavigation, { props: { section: 'components', mode: 'halo' } })
    await press('MCP 管理')
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['mcp'])
  })
  it.each(['local', 'halo'] as const)(
    'explains unavailable access in %s mode without network calls',
    async (mode) => {
      const client = setup(mode, ['plugin:plugin-lingui:library:view'])
      expect(
        wrapper!
          .findAll('button')
          .find((entry) => entry.text() === '测试连接')!
          .attributes('disabled'),
      ).toBeDefined()
      expect(wrapper!.text()).toContain(
        mode === 'local' ? '没有 Halo MCP 服务' : '没有 MCP 使用权限',
      )
      expect(client.initialize).not.toHaveBeenCalled()
    },
  )
  it('tests the actual connection, exposes tools and executes a read-only sample', async () => {
    const client = setup('halo', ['plugin:plugin-lingui:mcp:use'])
    expect(client.initialize).not.toHaveBeenCalled()
    await press('测试连接')
    expect(wrapper!.text()).toContain('连接正常')
    expect(wrapper!.text()).toContain('用户风格优先')
    await press('试运行工具')
    expect(client.call).toHaveBeenCalledWith(
      'search_components',
      { query: '按钮', limit: 5 },
      MCP_VERSION,
      expect.any(AbortSignal),
    )
    expect(wrapper!.get('[aria-label="MCP 工具返回结果"]').text()).toContain('105')
    await wrapper!
      .findAll('button')
      .find((entry) => entry.text().includes('get_current_work'))!
      .trigger('click')
    expect(wrapper!.text()).toContain('无法读取浏览器中尚未保存的编辑')
    expect(wrapper!.find('[aria-label="MCP 工具返回结果"]').exists()).toBe(false)
  })
  it('rejects invalid JSON before making a tool call', async () => {
    const client = setup()
    await press('测试连接')
    await wrapper!.get('textarea').setValue('{')
    await press('试运行工具')
    expect(wrapper!.get('[role="alert"]').text()).toContain('JSON 格式不正确')
    expect(client.call).not.toHaveBeenCalled()
  })
  it('shows permission failures and allows an explicit retry', async () => {
    const client = setup()
    vi.mocked(client.initialize).mockRejectedValueOnce({ response: { status: 403 } })
    await press('测试连接')
    expect(wrapper!.get('[role="alert"]').text()).toContain('使用 MCP 创作工具')
    expect(wrapper!.find('.lu-mcp-tools').exists()).toBe(false)
    await press('测试连接')
    expect(wrapper!.text()).toContain('连接正常')
  })
  it('copies placeholder configuration without collecting a credential', async () => {
    setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await press('复制配置')
    const config = JSON.parse(writeText.mock.calls[0]![0] as string)
    expect(config.mcpServers.lingui.url).toContain(EXTERNAL_MCP_PATH)
    expect(config.mcpServers.lingui.headers['X-Lingui-MCP-Key']).toBe('<LINGUI_MCP_KEY>')
    expect(wrapper!.find('input[type="password"]').exists()).toBe(false)
    expect(wrapper!.text()).toContain('已复制接入配置')
  })
  it('cancels connection checks when leaving the page', async () => {
    const client = setup()
    vi.mocked(client.initialize).mockReturnValue(new Promise(() => undefined))
    await press('测试连接')
    const signal = vi.mocked(client.initialize).mock.calls[0]![0]
    wrapper!.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
  })
})

describe('MCP authenticated transport', () => {
  it('sends JSON-RPC and negotiated headers through Halo axios', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockImplementation(async (_url, data) => {
      const rpc = data as { id: number; method: string }
      return { data: { jsonrpc: '2.0', id: rpc.id, result: {} } }
    })
    await createMcpClient().call('search_components', {}, MCP_VERSION, new AbortController().signal)
    expect(post).toHaveBeenCalledWith(
      MCP_PATH,
      expect.objectContaining({ method: 'tools/call' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': MCP_VERSION,
        }),
      }),
    )
  })
  it('does not treat a redirected login page as a connected MCP server', async () => {
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: '<html>login</html>' })
    await expect(createMcpClient().initialize(new AbortController().signal)).rejects.toThrow(
      '请确认已登录 Halo',
    )
  })
})
