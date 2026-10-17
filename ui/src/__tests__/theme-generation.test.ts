import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { axiosInstance } from '@halo-dev/api-client'
import { builtInThemes, pureTheme, type ThemeTokens } from '@lingui/renderer'
import ThemeStudio from '../theme-studio/ThemeStudio.vue'
import ThemeAiComposer from '../theme-studio/ai/ThemeAiComposer.vue'
import { createLocalRepository } from '../dev/local-repository'
import { createHaloRepository } from '../services/halo-repository'
import { repositoryKey } from '../services/repository'
import type { StudioRepository } from '../component-library/types'
import { externalAiInstructions } from '../mcp/external-ai'
import { parseGeneratedTheme } from '../theme-studio/ai/theme-result'

let wrapper: VueWrapper | undefined
const previous = utils.permission.getUserPermissions()
const generated: ThemeTokens = {
  ...pureTheme,
  id: 'ai-theme',
  name: 'AI 宋体主题',
  font: 'serif',
  radius: 0,
  colors: { ...pureTheme.colors, accent: '#7533aa' },
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  utils.permission.setUserPermissions(previous ?? [])
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function studio(
  generateTheme = vi.fn().mockResolvedValue(generated),
  permissions = ['*'],
  mode: StudioRepository['mode'] = 'halo',
) {
  utils.permission.setUserPermissions(permissions)
  const repository: StudioRepository = {
    ...createLocalRepository(),
    listFonts: async () => [],
    mode,
    generateTheme,
  }
  wrapper = mount(ThemeStudio, {
    attachTo: document.body,
    props: { themes: builtInThemes },
    global: { provide: { [repositoryKey as symbol]: repository } },
  })
  return { view: wrapper, generateTheme }
}
function button(label: string) {
  return wrapper!.findAll('button').find((button) => button.text() === label)!
}
async function send(text = '宋体，圆角 0，保留强调色') {
  await wrapper!.get('textarea[name="theme-instruction"]').setValue(text)
  await button('生成主题').trigger('submit')
  await flushPromises()
}
function surface() {
  return wrapper!
    .get('.lingui-renderer-host')
    .element.shadowRoot!.querySelector<HTMLElement>('.lingui-surface')!
}
function deferred() {
  let resolve!: (theme: ThemeTokens) => void
  const promise = new Promise<ThemeTokens>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('AI theme contracts', () => {
  it('accepts direct or fenced complete themes and rejects unsafe or partial outputs', () => {
    expect(parseGeneratedTheme(`\`\`\`json\n${JSON.stringify(generated)}\n\`\`\``)).toEqual(
      generated,
    )
    for (const text of [
      '{"schemaVersion":"lingui.theme/1"}',
      '{"__proto__":{}}',
      JSON.stringify({ ...generated, font: 'external-url' }),
      'x'.repeat(262145),
      '```json\n{"name":',
      JSON.stringify({ theme: generated }),
    ])
      expect(() => parseGeneratedTheme(text)).toThrow()
  })
  it('uses live MCP theme guidance with existing author settings', () => {
    const instructions = externalAiInstructions({
      endpoint: 'https://halo.example.com/mcp',
      kind: 'theme',
      instruction: '宋体，圆角为 0',
      theme: generated,
    })
    expect(instructions).toContain('get_guidance(topic="theme")')
    expect(instructions).toContain('宋体，圆角为 0')
    expect(instructions).toContain(JSON.stringify(generated))
    expect(instructions).not.toContain('LingUI.Column')
    expect(instructions).not.toContain('lingui.document/2')
  })
  it('calls the generated Halo theme endpoint and validates its output', async () => {
    const request = vi
      .spyOn(axiosInstance, 'request')
      .mockResolvedValue({ data: { content: JSON.stringify(generated) } })
    const repository = createHaloRepository()
    await expect(repository.generateTheme('宋体', pureTheme)).resolves.toEqual(generated)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/apis/console.api.lingui.acanyo.com/v1alpha1/generate-theme',
        data: JSON.stringify({ instruction: '宋体', theme: JSON.stringify(pureTheme) }),
      }),
    )
    request.mockResolvedValueOnce({ data: { content: '{}' } })
    await expect(repository.generateTheme('宋体', pureTheme)).rejects.toThrow()
  })
})

describe('AI theme preview workflow', () => {
  it('previews a validated new draft without saving or resetting interactive input', async () => {
    const { view, generateTheme } = studio()
    await flushPromises()
    const input = surface().querySelector<HTMLInputElement>('.lg-input-shell input')!
    input.value = '保留对话前的交互'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await send()
    expect(generateTheme).toHaveBeenCalledWith('宋体，圆角 0，保留强调色', pureTheme)
    expect(surface().style.getPropertyValue('--lingui-radius')).toBe('0px')
    expect(surface().style.getPropertyValue('--lingui-accent')).toBe('#7533aa')
    expect(surface().querySelector<HTMLInputElement>('.lg-input-shell input')!.value).toBe(
      '保留对话前的交互',
    )
    expect(view.get('.lu-theme-font-trigger').text()).toBe('衬线 / 宋体')
    expect(view.text()).toContain('未保存')
    expect(view.emitted('save')).toBeUndefined()
    await view.get('input[aria-label="强调色色值"]').setValue('#125678')
    await send('只调整间距')
    expect(generateTheme.mock.calls[1]![1].colors.accent).toBe('#125678')
    await button('保存为我的主题').trigger('click')
    const saved = view.emitted('save')!.at(-1)![0] as ThemeTokens
    expect(saved.id).not.toBe('ai-theme')
    expect(saved.radius).toBe(0)
  })
  it('holds AI output when the author changes a field during generation', async () => {
    const pending = deferred()
    const { view, generateTheme } = studio(vi.fn().mockReturnValue(pending.promise))
    await send()
    expect(button('正在设计…').attributes('disabled')).toBeDefined()
    await view.get('input[aria-label="强调色色值"]').setValue('#224466')
    pending.resolve(generated)
    await flushPromises()
    expect(surface().style.getPropertyValue('--lingui-accent')).toBe('#224466')
    expect(view.text()).toContain('生成期间你调整了主题')
    expect(button('生成主题').attributes('disabled')).toBeDefined()
    await button('使用 AI 主题').trigger('click')
    await flushPromises()
    expect(surface().style.getPropertyValue('--lingui-accent')).toBe('#7533aa')
    expect(generateTheme).toHaveBeenCalledTimes(1)
    expect(view.emitted('save')).toBeUndefined()
  })
  it('preserves an incomplete color field and allows the author to keep it', async () => {
    const pending = deferred()
    const { view } = studio(vi.fn().mockReturnValue(pending.promise))
    await send()
    await view.get('input[aria-label="强调色色值"]').setValue('#12')
    pending.resolve(generated)
    await flushPromises()
    expect(view.get('input[aria-label="强调色色值"]').element).toHaveProperty('value', '#12')
    await button('保留我的修改').trigger('click')
    expect(view.find('.lu-theme-ai-candidate').exists()).toBe(false)
    expect(button('生成主题').attributes('disabled')).toBeDefined()
  })
  it('holds an in-flight result after switching presets and restores the original after AI preview', async () => {
    const pending = deferred()
    const { view } = studio(vi.fn().mockReturnValue(pending.promise))
    await send()
    await view.get('button[aria-label="Graphite · 深灰暗色"]').trigger('click')
    pending.resolve(generated)
    await flushPromises()
    expect(view.get('input[maxlength="120"]').element).toHaveProperty(
      'value',
      'Graphite · 深灰暗色',
    )
    await button('使用 AI 主题').trigger('click')
    await button('还原修改').trigger('click')
    expect(view.get('input[maxlength="120"]').element).toHaveProperty(
      'value',
      'Graphite · 深灰暗色',
    )
  })
  it('shows safe provider diagnostics and supports retry without changing the current theme', async () => {
    const generateTheme = vi
      .fn()
      .mockRejectedValueOnce({
        response: {
          status: 502,
          data: {
            detail: 'AI 服务商凭据无效',
            category: 'provider-http',
            providerStatus: 401,
            reference: 'abcd1234',
          },
        },
      })
      .mockResolvedValueOnce(generated)
    const { view } = studio(generateTheme)
    await send()
    expect(view.text()).toContain('AI 服务商凭据无效')
    expect(view.text()).toContain('AI 服务商：HTTP 401')
    expect(view.text()).toContain('诊断编号：abcd1234')
    expect(surface().style.getPropertyValue('--lingui-accent')).toBe(pureTheme.colors.accent)
    await button('重试生成').trigger('click')
    await flushPromises()
    expect(generateTheme).toHaveBeenCalledTimes(2)
    expect(view.find('.lu-theme-ai-error').exists()).toBe(false)
  })
  it('rejects invalid generated themes and suppresses results after unmount', async () => {
    const { view } = studio(vi.fn().mockResolvedValue({ ...generated, radius: 99 }))
    await send()
    expect(view.text()).toContain('AI 返回的主题格式不完整')
    expect(view.text()).toContain('radius 超出允许范围')
    expect(view.emitted('save')).toBeUndefined()
    const pending = deferred()
    view.unmount()
    const second = studio(vi.fn().mockReturnValue(pending.promise)).view
    const composer = second.getComponent(ThemeAiComposer)
    await send()
    second.unmount()
    wrapper = undefined
    pending.resolve(generated)
    await flushPromises()
    expect(second.emitted('save')).toBeUndefined()
    expect(composer.emitted('generated')).toBeUndefined()
  })
  it.each(['local', 'halo'] as const)(
    'offers the external AI workflow when direct generation is unavailable: %s',
    async (mode) => {
      const { view, generateTheme } = studio(vi.fn(), ['plugin:plugin-lingui:library:view'], mode)
      expect(view.findAll('button').some((item) => item.text() === '生成主题')).toBe(false)
      await button('导入 AI 主题').trigger('click')
      expect(view.get('details.lu-advanced').element).toHaveProperty('open', true)
      expect(document.activeElement).toBe(view.get('textarea[aria-label="主题 JSON"]').element)
      await view
        .get('textarea[aria-label="主题 JSON"]')
        .setValue(`\`\`\`json\n${JSON.stringify(generated)}\n\`\`\``)
      await button('校验并预览').trigger('click')
      await flushPromises()
      expect(surface().style.getPropertyValue('--lingui-radius')).toBe('0px')
      expect(generateTheme).not.toHaveBeenCalled()
      expect(view.emitted('save')).toBeUndefined()
    },
  )
})
