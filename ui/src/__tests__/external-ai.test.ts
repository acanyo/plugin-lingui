import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import { utils } from '@halo-dev/ui-shared'
import { createInstance, examples, pureTheme } from '@lingui/renderer'
import AiComposer from '../ai-adapter/AiComposer.vue'
import ThemeAiComposer from '../theme-studio/ai/ThemeAiComposer.vue'
import ExternalAiDialog from '../mcp/ExternalAiDialog.vue'
import { endpointForHaloSite, externalAiInstructions } from '../mcp/external-ai'
import { OFFICIAL_MCP_PATH, SKILL_TOOL } from '../mcp/connection'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'

let wrapper: VueWrapper | undefined
const permissions = utils.permission.getUserPermissions()
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  utils.permission.setUserPermissions(permissions ?? [])
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
function clipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  return writeText
}
const globals = () => ({
  plugins: [[formkit, defaultConfig()]] as [typeof formkit, ReturnType<typeof defaultConfig>][],
  stubs: { teleport: true, transition: false },
})
function setup(props: Partial<InstanceType<typeof ExternalAiDialog>['$props']> = {}) {
  wrapper = mount(ExternalAiDialog, {
    attachTo: document.body,
    props: { mode: 'halo', canUseMcp: true, ...props },
    global: globals(),
  })
}
function button(label: string) {
  const found = wrapper!.findAll('button').find((entry) => entry.text().trim() === label)
  expect(found, label).toBeDefined()
  return found!
}
async function press(label: string) {
  await button(label).trigger('click')
  await flushPromises()
}

describe('external AI handoff', () => {
  it('uses the current Halo endpoint, placeholder credentials and live Skill/tools instead of a catalog prompt', async () => {
    const writeText = clipboard()
    const instance = createInstance(examples[0]!.create())
    instance.templateId = 'saved-work-42'
    setup({ instance, dirty: true, instruction: '按我的直角紫色风格调整' })
    await press('复制 MCP 配置')
    const configuration = JSON.parse(writeText.mock.calls[0]![0])
    expect(configuration.mcpServers.halo.url).toBe(new URL(OFFICIAL_MCP_PATH, location.origin).href)
    expect(configuration.mcpServers.halo.headers).toEqual({
      Authorization: 'Bearer ${env:HALO_MCP_TOKEN}',
    })
    await press('复制 AI 接入说明')
    const instructions = writeText.mock.calls[1]![0] as string
    for (const required of [
      `${SKILL_TOOL}(topic="skill")`,
      'tools/list',
      'plugin-lingui__',
      '工具 → MCP 服务',
      'get_current_work(workName="saved-work-42")',
      'get_component_schemas',
      'validate_design',
      '按我的直角紫色风格调整',
      '未保存的修改',
    ])
      expect(instructions).toContain(required)
    expect(instructions).not.toContain(instance.document.source)
    expect(instructions).not.toContain('目录 Schema')
    expect(wrapper!.text()).toContain('MCP 读取最近保存的版本')
    expect(wrapper!.find('input[type="password"]').exists()).toBe(false)
  })

  it('requires an explicit valid Halo destination in local mode and never treats local project IDs as Halo resource names', async () => {
    const writeText = clipboard()
    const instance = createInstance(examples[0]!.create())
    instance.templateId = 'local-only-project'
    setup({ mode: 'local', canUseMcp: false, instance })
    await flushPromises()
    expect(wrapper!.text()).toContain('没有 MCP 服务')
    expect(button('复制 MCP 配置').attributes('disabled')).toBeDefined()
    expect(wrapper!.find('pre').exists()).toBe(false)
    const input = wrapper!.get('input[name="halo-site"]')
    await input.setValue('https://secret-token@halo.example.com')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('不要在地址中包含账号或令牌'))
    expect(button('复制 AI 接入说明').attributes('disabled')).toBeDefined()
    await input.setValue('https://halo.example.com/console/lingui')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('不含控制台路径'))
    await input.setValue('https://halo.example.com')
    await vi.waitFor(() => expect(button('复制 MCP 配置').attributes('disabled')).toBeUndefined())
    await press('复制 MCP 配置')
    expect(JSON.parse(writeText.mock.calls[0]![0]).mcpServers.halo.url).toBe(
      `https://halo.example.com${OFFICIAL_MCP_PATH}`,
    )
    await press('复制 AI 接入说明')
    expect(writeText.mock.calls[1]![0]).not.toContain('local-only-project')
    expect(writeText.mock.calls[1]![0]).toContain('提供导出的作品 JSON')
  })

  it('explains permissions and exposes manual copying after clipboard failure', async () => {
    clipboard().mockRejectedValue(new Error('denied'))
    setup({ canUseMcp: false })
    expect(wrapper!.text()).toContain('当前账号没有灵构 MCP 创作工具权限')
    await press('复制 AI 接入说明')
    expect(wrapper!.get('[role="alert"]').text()).toContain('手动复制')
    expect(wrapper!.get('details').element).toHaveProperty('open', true)
    expect(wrapper!.get('pre[aria-label="AI 接入说明"]').text()).toContain(SKILL_TOOL)
  })

  it('preserves the unsent demand when opening/closing onboarding and moves to the existing import flow without generating or saving', async () => {
    const repository = createLocalRepository()
    const generate = vi.spyOn(repository, 'generate')
    const save = vi.spyOn(repository, 'saveTemplate')
    wrapper = mount(AiComposer, {
      attachTo: document.body,
      global: { ...globals(), provide: { [repositoryKey as symbol]: repository } },
    })
    await wrapper.get('textarea').setValue('尚未发送的需求')
    expect(wrapper.text()).not.toContain('复制提示词')
    await press('连接外部 AI')
    expect(wrapper.getComponent(ExternalAiDialog).props('instruction')).toBe('尚未发送的需求')
    await press('返回创作')
    expect(wrapper.get('textarea').element).toHaveProperty('value', '尚未发送的需求')
    await press('连接外部 AI')
    await press('导入生成结果')
    expect(wrapper.findComponent(ExternalAiDialog).exists()).toBe(false)
    expect(wrapper.emitted('import')).toHaveLength(1)
    expect(wrapper.get('textarea').element).toHaveProperty('value', '尚未发送的需求')
    expect(generate).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('connects theme creation through the same entry and returns to theme import', async () => {
    const repository = { ...createLocalRepository(), mode: 'halo' as const }
    utils.permission.setUserPermissions(['plugin:plugin-lingui:mcp:use'])
    const writeText = clipboard()
    wrapper = mount(ThemeAiComposer, {
      attachTo: document.body,
      props: { theme: pureTheme, revision: 0, blocked: false },
      global: { ...globals(), provide: { [repositoryKey as symbol]: repository } },
    })
    await wrapper.get('textarea').setValue('深色等宽，圆角 0')
    await press('连接外部 AI')
    await press('复制 AI 接入说明')
    expect(writeText.mock.calls[0]![0]).toContain('get_guidance(topic="theme")')
    expect(writeText.mock.calls[0]![0]).toContain('深色等宽，圆角 0')
    await press('导入 AI 主题')
    expect(wrapper.emitted('import')).toHaveLength(1)
    expect(wrapper.get('textarea').element).toHaveProperty('value', '深色等宽，圆角 0')
  })

  it('validates destination URLs and asks for a demand when none was entered', () => {
    for (const site of [
      'javascript:alert(1)',
      'file:///tmp/halo',
      'https://halo.example/?token=secret',
      'https://halo.example/#token',
    ])
      expect(() => endpointForHaloSite(site)).toThrow()
    const instructions = externalAiInstructions({
      kind: 'component',
      endpoint: 'https://halo.example/mcp',
    })
    expect(instructions).toContain('询问我本次的创作需求')
    expect(instructions).not.toContain('生成一个可交互的文章组件')
  })
})
