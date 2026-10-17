import { axiosInstance } from '@halo-dev/api-client'
import {
  LinguiMcpKeysApi,
  ComponentTemplateV1alpha1Api,
  type CreateMcpKeyRequest,
  type IssuedMcpKey,
  type McpKeyInfo,
} from '../../api/generated'

export type { McpKeyInfo, IssuedMcpKey }
export interface WorkChoice {
  value: string
  label: string
}
export interface McpKeyClient {
  list(): Promise<McpKeyInfo[]>
  create(input: CreateMcpKeyRequest): Promise<IssuedMcpKey>
  revoke(id: string): Promise<void>
  delete(id: string): Promise<void>
  works(): Promise<WorkChoice[]>
}

export function createMcpKeyClient(): McpKeyClient {
  const api = new LinguiMcpKeysApi(undefined, '', axiosInstance)
  const works = new ComponentTemplateV1alpha1Api(undefined, '', axiosInstance)
  return {
    async list() {
      return (await api.listMcpKeys()).data.items ?? []
    },
    async create(input) {
      return (await api.createMcpKey({ createMcpKeyRequest: input })).data
    },
    async revoke(id) {
      await api.revokeMcpKey({ name: id })
    },
    async delete(id) {
      await api.deleteMcpKey({ name: id })
    },
    async works() {
      const choices: WorkChoice[] = []
      for (let page = 1; ; page++) {
        const { data } = await works.listComponentTemplate({ page, size: 100 })
        choices.push(
          ...data.items
            .filter((work) => !work.metadata.deletionTimestamp)
            .map((work) => ({
              value: work.metadata.name,
              label: work.spec.displayName,
            })),
        )
        if (page * 100 >= data.total) return choices
      }
    },
  }
}
export function keyError(cause: unknown): string {
  const response = (cause as { response?: { status: number; data?: { detail?: string } } })
    ?.response
  if (response?.status === 401) return '登录已过期，请重新登录后管理密钥。'
  if (response?.status === 403)
    return '当前账号没有此操作的权限，请管理员授予「使用 MCP 创作工具」。'
  return response?.data?.detail ?? (cause instanceof Error ? cause.message : '操作失败，请重试。')
}
export function keyStatus(key: McpKeyInfo): string {
  if (key.revoked) return '已撤销'
  return Date.parse(key.expiresAt ?? '') > Date.now() ? '使用中' : '已过期'
}
export function keyWorkScope(key: McpKeyInfo): string {
  if (key.allWorks) return '全部项目 · 包含以后新建的项目'
  return key.workNames?.length
    ? `已授权 ${key.workNames.length} 个项目`
    : '仅查询与校验 · 未授权读取项目'
}
export function keyDate(value?: string): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未使用'
}
