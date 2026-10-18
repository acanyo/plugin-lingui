import type { ThemeTokens } from '@lingui/renderer'
import { OFFICIAL_MCP_PATH, SKILL_TOOL } from './connection'

/** Resolve only an explicitly supplied Halo site; the standalone frontend has no MCP server. */
export function endpointForHaloSite(site: string): string {
  const url = new URL(site.trim())
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('请输入 HTTP 或 HTTPS 站点地址，不要在地址中包含账号或令牌。')
  if (url.pathname !== '/' || url.search || url.hash)
    throw new Error('请输入 Halo 站点根地址，例如 https://halo.example.com，不含控制台路径。')
  return new URL(OFFICIAL_MCP_PATH, url.origin).href
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
    `1. 使用 Halo 官方 MCP Server 1.3.0 或更高的 1.x 版本提供的 HTTP MCP 服务，地址：${context.endpoint}，示例服务别名为 halo。若尚未配置，请指导我安装并启用官方插件，在「工具 → MCP 服务」创建访问密钥、选择「灵构 UI」工具，并在 AI 客户端配置 Authorization: Bearer。不要索取密钥或把它写入作品。`,
    `2. 先通过 tools/list 获取该访问密钥已选择的工具，再调用 ${SKILL_TOOL}(topic="skill") 读取并遵循创作 Skill，详细规则通过该工具的其他 topic 按需读取。下文工具的官方协议名称均为 plugin-lingui__ 加本地名称；客户端可能再加服务别名前缀，请使用客户端实际提供的可调用名称。若工具不可见，请让我在官方 MCP 服务中将它加入当前访问密钥。连接或工具调用失败时先说明问题，不要猜测组件协议。`,
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
        `3. 修改已保存作品前，调用 get_current_work(workName=${JSON.stringify(context.workName)}) 读取最近保存的版本。该工具需要在官方访问密钥中选中，创建密钥的账号也需要灵构创作工具与目标作品的读取权限。访问被拒绝时，请让我调整工具选择和账号权限，或提供导出的作品 JSON。`,
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
