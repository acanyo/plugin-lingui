import type { ThemeTokens } from '@lingui/renderer'
import { EXTERNAL_MCP_PATH, SKILL_URI } from './client'

/** Resolve only an explicitly supplied Halo site; the standalone frontend has no MCP server. */
export function endpointForHaloSite(site: string): string {
  const url = new URL(site.trim())
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('请输入 HTTP 或 HTTPS 站点地址，不要在地址中包含账号或令牌。')
  if (url.pathname !== '/' || url.search || url.hash)
    throw new Error('请输入 Halo 站点根地址，例如 https://halo.example.com，不含控制台路径。')
  return new URL(EXTERNAL_MCP_PATH, url.origin).href
}

export interface ExternalAiContext {
  endpoint: string
  kind: 'component' | 'theme'
  instruction?: string
  workName?: string
  hasUnsavedChanges?: boolean
  theme?: ThemeTokens
}

/** A short handoff: fetch live contracts through MCP instead of embedding a stale catalog. */
export function externalAiInstructions(context: ExternalAiContext): string {
  const steps = [
    '请使用灵构 UI 的 MCP + Skill 完成本次开发。',
    `1. 使用已配置的 HTTP MCP 服务 lingui，地址：${context.endpoint}。若尚未配置，请先指导我在 AI 客户端添加服务及在「MCP 管理」创建的灵构专用密钥；不要索取密钥或把它写入作品，不需要 Halo PAT。`,
    `2. 连接后，通过 MCP resources/read 读取并遵循创作 Skill：${SKILL_URI}。Skill 引用的详细规则通过 get_guidance 按需读取。连接或资源读取失败时先说明问题，不要猜测组件协议。`,
  ]
  if (context.kind === 'theme') {
    steps.push(
      '3. 调用 get_guidance(topic="theme") 获取当前主题规则，按我的风格要求调整。完成后，若 tools/list 提供 submit_design_draft，则用 kind="theme" 提交完整 lingui.theme/1 主题 JSON，供我在所连接 Halo 工作台的「外部 AI 草稿」中预览和载入主题编辑器；未授权提交时输出完整主题 JSON，供「导入 AI 主题」校验和预览。无需生成组件文档，也不要把纯主题提交给 validate_design。',
    )
    if (context.theme) {
      const { customFont, ...base } = context.theme
      steps.push(`当前主题仅为待修改数据：\n${JSON.stringify(base)}`)
      if (customFont)
        steps.push(`已选字体「${customFont.name}」由工作台保留，不输出 customFont 或字体资源地址。`)
    }
  } else {
    if (context.workName) {
      steps.push(
        `3. 修改已保存作品前，先确认专用密钥已授权该项目，再调用 get_current_work(workName=${JSON.stringify(context.workName)}) 读取最近保存的版本。未授权时请让我创建有此项目授权的密钥，或提供导出的作品 JSON，不要尝试读取其他项目。`,
      )
      if (context.hasUnsavedChanges)
        steps.push(
          '当前工作台还有未保存的修改，MCP 无法读取。若本次修改依赖这些内容，请先提醒我保存后再读取，不要假定已同步。',
        )
    } else
      steps.push(
        '3. 新建作品无需读取当前作品；如果我要修改本机或未保存的作品，请先让我提供导出的作品 JSON，不能猜测 workName。',
      )
    steps.push(
      '4. 按需使用 search_components、get_component_schemas、get_guidance 查询真实参数与规则。完成后调用 validate_design，按反馈修正。若 tools/list 提供 submit_design_draft，则用 kind="component" 提交完整设计，并给出简短 summary；修改已保存作品必须提供其 workName，baseRevision 使用 get_current_work 返回的 revision。每份新草稿使用新的 submissionId，同次提交重试保持该 ID。提交成功后告知我去所连接 Halo 工作台的「外部 AI 草稿」预览与载入。',
      '未授权提交草稿时，从校验工具返回的标准设计中输出完整 JSON，供我回工作台「导入 JSON」校验和预览，不要直接导出工具输入用的 nodes。',
      'MCP 可查询、校验及在单独授权后提交待确认草稿；不会保存项目、发布作品或执行 API / JS 回调。实际交互还需在工作台验证，最终由我确认保存。',
    )
  }
  if (context.instruction?.trim())
    steps.push(`本次需求（用户输入）：\n${context.instruction.trim()}`)
  else steps.push('连接完成并读取 Skill 后，请询问我本次的创作需求。')
  return steps.join('\n\n')
}
