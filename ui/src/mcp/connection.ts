/** Connection paths and authentication belong to Halo's official MCP Server plugin. */
export const OFFICIAL_MCP_PATH = '/mcp'
export const OFFICIAL_MCP_CONSOLE_PATH = '/console/mcp'
export const MCP_TOKEN_ENV_VAR = 'HALO_MCP_TOKEN'
export const SKILL_TOOL = 'plugin-lingui__get_guidance'

/** This example contains only an environment variable reference, never a plaintext key. */
export function clientConfiguration(endpoint: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        halo: {
          type: 'http',
          url: endpoint,
          headers: { Authorization: `Bearer \${env:${MCP_TOKEN_ENV_VAR}}` },
        },
      },
    },
    null,
    2,
  )
}

export function codexConfiguration(endpoint: string): string {
  return `[mcp_servers.halo]\nurl = ${JSON.stringify(endpoint)}\nbearer_token_env_var = "${MCP_TOKEN_ENV_VAR}"`
}
