import { describe, expect, it } from 'vitest'
import { generationError } from '../ai-adapter/generation-error'
describe('AI generation diagnostics', () => {
  it('shows the API reason, provider status and reference without other response fields', () => {
    const error = {
      response: {
        status: 502,
        data: {
          detail: 'AI 服务商认证失败（HTTP 401）',
          category: 'provider-http',
          providerStatus: 401,
          reference: 'ab12cd34',
          rawBody: 'secret',
          headers: { Authorization: 'private-key' },
        },
      },
    }
    const display = generationError(error)
    expect(display.text).toContain('认证失败')
    expect(display.details).toContain('AI 服务商：HTTP 401')
    expect(display.details).toContain('工作台接口：HTTP 502')
    expect(display.details).toContain('ab12cd34')
    expect(JSON.stringify(display)).not.toMatch(/private-key|secret/)
  })
  it('labels server validation failures and preserves their diagnostic reference', () => {
    const display = generationError({
      response: {
        status: 502,
        data: {
          category: 'invalid-design',
          reference: '3a88fde6',
          detail: 'AI 返回内容未通过作品校验',
        },
      },
    })
    expect(display.details).toContain('生成内容未通过作品校验')
    expect(display.details).toContain('3a88fde6')
  })
  it('distinguishes provider failures from plugin authorization and expired login', () => {
    expect(
      generationError({ response: { status: 403, data: { detail: 'Forbidden' } } }).text,
    ).toContain('AI 生成权限')
    expect(generationError({ response: { status: 401 } }).text).toContain('登录已失效')
    expect(
      generationError({
        response: {
          status: 403,
          data: { detail: '服务商拒绝访问', category: 'provider-http', providerStatus: 403 },
        },
      }).text,
    ).toBe('服务商拒绝访问')
  })
  it('handles browser connectivity, timeout and invalid generated content separately', () => {
    expect(generationError({ code: 'ERR_NETWORK', message: 'Network Error' }).text).toContain(
      '无法连接 Halo',
    )
    expect(generationError({ code: 'ECONNABORTED' }).text).toContain('响应超时')
    const validation = generationError(new Error('A2UI 缺少组件节点'))
    expect(validation.text).toContain('格式不完整')
    expect(validation.details).toContain('缺少组件节点')
  })
})
