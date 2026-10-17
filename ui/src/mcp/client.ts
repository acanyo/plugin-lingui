import { axiosInstance } from '@halo-dev/api-client'

export const EXTERNAL_MCP_PATH = '/apis/api.lingui.acanyo.com/v1alpha1/mcp'
export const MCP_PATH = '/apis/console.api.lingui.acanyo.com/v1alpha1/mcp'
export const MCP_VERSION = '2025-11-25'
export const SKILL_URI = 'lingui://skills/lingui-create/SKILL.md'

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
}
export interface McpServer {
  protocolVersion: string
  serverInfo: { name: string; version: string }
}
export interface McpToolResult {
  isError?: boolean
  content: { type: string; text?: string }[]
  structuredContent?: unknown
}
export interface McpClient {
  initialize(signal: AbortSignal): Promise<McpServer>
  inspect(version: string, signal: AbortSignal): Promise<{ tools: McpTool[]; skill: string }>
  call(
    name: string,
    args: Record<string, unknown>,
    version: string,
    signal: AbortSignal,
  ): Promise<McpToolResult>
}

/** MCP is JSON-RPC, not a Halo resource API. Reuse the authenticated Halo transport. */
export function createMcpClient(): McpClient {
  let nextId = 0
  async function request<T>(
    method: string,
    params: object,
    version: string | undefined,
    signal: AbortSignal,
  ): Promise<T> {
    const id = ++nextId
    const { data } = await axiosInstance.post(
      MCP_PATH,
      { jsonrpc: '2.0', id, method, params },
      {
        signal,
        timeout: 20000,
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          ...(version ? { 'MCP-Protocol-Version': version } : {}),
        },
      },
    )
    if (data?.jsonrpc !== '2.0' || data.id !== id)
      throw new Error('未收到有效的 MCP 响应。请确认已登录 Halo，并安装支持 MCP 的灵构 UI 版本。')
    if (data.error) throw new Error(`MCP ${data.error.code}：${data.error.message}`)
    if (!data.result || typeof data.result !== 'object') throw new Error('MCP 响应缺少结果')
    return data.result as T
  }
  return {
    initialize: (signal) =>
      request(
        'initialize',
        {
          protocolVersion: MCP_VERSION,
          capabilities: {},
          clientInfo: { name: 'lingui-workbench', version: '1.0.0' },
        },
        undefined,
        signal,
      ),
    async inspect(version, signal) {
      // Stateless server: no session ID or long-lived event stream is needed.
      await axiosInstance.post(
        MCP_PATH,
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        {
          signal,
          timeout: 20000,
          headers: {
            Accept: 'application/json, text/event-stream',
            'MCP-Protocol-Version': version,
          },
        },
      )
      const [list, resource] = await Promise.all([
        request<{ tools: McpTool[] }>('tools/list', {}, version, signal),
        request<{ contents: { uri: string; text: string }[] }>(
          'resources/read',
          { uri: SKILL_URI },
          version,
          signal,
        ),
        request('ping', {}, version, signal),
      ])
      if (!Array.isArray(list.tools) || !Array.isArray(resource.contents))
        throw new Error('MCP 工具或 Skill 资源格式无效')
      const skill = resource.contents.find((entry) => entry.uri === SKILL_URI)?.text
      if (typeof skill !== 'string') throw new Error('MCP 未返回创作 Skill')
      return { tools: list.tools, skill }
    },
    call: (name, args, version, signal) =>
      request('tools/call', { name, arguments: args }, version, signal),
  }
}

export function mcpError(cause: unknown): string {
  const error = (cause ?? {}) as { response?: { status?: number }; code?: string }
  if (error.response?.status === 401) return '登录已过期，请重新登录 Halo 后测试连接。'
  if (error.response?.status === 403)
    return '当前账号无 MCP 权限。请管理员授予「使用 MCP 创作工具」。'
  if (error.response?.status === 404)
    return '未找到 MCP 服务，请确认已安装包含 MCP 功能的灵构 UI 版本。'
  if (error.code === 'ECONNABORTED') return 'MCP 连接超时，请检查 Halo 服务后重试。'
  return cause instanceof Error ? cause.message : 'MCP 请求失败，请检查 Halo 服务后重试。'
}

/** Real keys are passed only while displaying a newly issued key; never persist this configuration. */
export function clientConfiguration(endpoint: string, key?: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        lingui: {
          type: 'http',
          url: endpoint,
          headers: { 'X-Lingui-MCP-Key': key ?? '<LINGUI_MCP_KEY>' },
        },
      },
    },
    null,
    2,
  )
}
