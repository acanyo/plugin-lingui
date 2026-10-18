import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { axiosInstance } from '@halo-dev/api-client'
import McpManagementView from '../mcp/McpManagementView.vue'
import StudioNavigation from '../workspace/StudioNavigation.vue'
import {
  OFFICIAL_MCP_PATH,
  OFFICIAL_MCP_CONSOLE_PATH,
  MCP_TOKEN_ENV_VAR,
  SKILL_TOOL,
  clientConfiguration,
  codexConfiguration,
} from '../mcp/connection'
import { createHaloRepository } from '../services/halo-repository'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'

let wrapper: VueWrapper | undefined
const previous = utils.permission.getUserPermissions()
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  utils.permission.setUserPermissions(previous ?? [])
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function setup(mode: 'local' | 'halo' = 'halo', permissions = ['*']) {
  utils.permission.setUserPermissions(permissions)
  wrapper = mount(McpManagementView, {
    props: { mode },
    global: {
      provide: {
        [repositoryKey as symbol]:
          mode === 'halo' ? createHaloRepository() : createLocalRepository(),
      },
    },
  })
}
async function press(label: string) {
  const button = wrapper!.findAll('button').find((entry) => entry.text().trim() === label)
  expect(button, label).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}

describe('official MCP integration', () => {
  it('provides a navigation entry', async () => {
    wrapper = mount(StudioNavigation, { props: { section: 'components', mode: 'halo' } })
    await press('MCP 管理')
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['mcp'])
  })

  it('delegates tool inspection and access keys to the official console without making protocol requests', () => {
    const post = vi.spyOn(axiosInstance, 'post')
    const request = vi.spyOn(axiosInstance, 'request')
    setup()
    const officialLink = wrapper!
      .findAll('a')
      .find((entry) => entry.text() === '打开官方 MCP 服务')!
    expect(officialLink.attributes('href')).toBe(OFFICIAL_MCP_CONSOLE_PATH)
    expect(wrapper!.text()).toContain('MCP Server 1.x ≥ 1.3.0')
    expect(wrapper!.text()).toContain('已有密钥也需要手动添加新工具')
    expect(wrapper!.text()).toContain(`${SKILL_TOOL}(topic="skill")`)
    expect(wrapper!.text()).toContain('plugin-lingui__submit_design_draft')
    expect(wrapper!.find('textarea').exists()).toBe(false)
    expect(wrapper!.find('input[type="password"]').exists()).toBe(false)
    expect(post).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })

  it('copies official endpoint and environment-based configurations', async () => {
    setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const endpoint = new URL(OFFICIAL_MCP_PATH, window.location.origin).href
    await wrapper!.get('[aria-label="复制 MCP 地址"]').trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(endpoint)
    await press('复制配置')
    const config = JSON.parse(writeText.mock.calls[1]![0] as string)
    expect(config.mcpServers.halo.url).toBe(endpoint)
    expect(config.mcpServers.halo.headers).toEqual({
      Authorization: `Bearer \${env:${MCP_TOKEN_ENV_VAR}}`,
    })
    await press('复制 Codex 配置')
    expect(writeText).toHaveBeenLastCalledWith(codexConfiguration(endpoint))
    expect(wrapper!.text()).toContain('已复制Codex 配置')
  })

  it('keeps drafts available to authorized users and opens the existing inbox', async () => {
    setup('halo', ['plugin:plugin-lingui:mcp:use'])
    await press('草稿与操作记录')
    expect(wrapper!.emitted('drafts')).toHaveLength(1)
  })

  it.each(['local', 'halo'] as const)(
    'shows setup independently of draft access in %s mode',
    (mode) => {
      setup(mode, ['plugin:plugin-lingui:library:view'])
      expect(
        wrapper!.findAll('button').some((entry) => entry.text().includes('草稿与操作记录')),
      ).toBe(false)
      expect(wrapper!.text()).toContain('官方 MCP')
      expect(wrapper!.find('a').exists()).toBe(mode === 'halo')
      if (mode === 'local') {
        expect(wrapper!.text()).toContain('独立前端工作空间')
        expect(wrapper!.find('pre').exists()).toBe(false)
      }
    },
  )

  it('provides configuration examples that reference only the official token environment variable', () => {
    const endpoint = 'https://halo.example/mcp'
    expect(clientConfiguration(endpoint)).toContain('Authorization')
    expect(codexConfiguration(endpoint)).toBe(
      '[mcp_servers.halo]\nurl = "https://halo.example/mcp"\nbearer_token_env_var = "HALO_MCP_TOKEN"',
    )
  })
})
