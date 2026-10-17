import { axiosInstance } from '@halo-dev/api-client'
import { LinguiMarketApi } from '../api/generated'
import { exportSubmission, importSubmission, type SubmissionDraft } from './submission'
import { validateInstance } from '@lingui/renderer'
import type { MarketplaceWork } from './catalog'
export type {
  MarketConnection,
  CommunityWork,
  CommunityPage,
  MyMarketWork,
  MyMarketDetail,
  MyMarketPage,
} from '../api/generated'
export const marketSite = 'https://auth.lik.cc'
export const marketName = '林间时光盒'
const api = new LinguiMarketApi(undefined, '', axiosInstance)
export const marketService = {
  async list(page = 1, query = '', kind?: 'component' | 'theme') {
    return (await api.listCommunityWorks({ page, size: 9, query, kind })).data
  },
  async get(name: string): Promise<MarketplaceWork> {
    const { data } = await api.getCommunityWork({ name })
    if (!data.work?.name || !data.packageJson) throw new Error('市场作品数据不完整')
    const draft = importSubmission(data.packageJson)
    const instance = validateInstance(draft.instance)
    delete instance.templateId
    delete instance.templateVersion
    return {
      id: data.work.name,
      title: draft.title,
      description: draft.description,
      category: draft.category,
      kind: draft.kind,
      icon: draft.kind === 'theme' ? 'palette' : 'layers',
      source: 'community',
      publisher: draft.author,
      license: draft.license,
      version: draft.version,
      provenance: draft.provenance,
      demos: draft.demos,
      instance,
      create: () => validateInstance(instance).document,
    }
  },
  async connection() {
    return (await api.getMarketConnection()).data
  },
  async connect(token: string) {
    return (await api.connectMarketAccount({ marketConnectRequest: { token } })).data
  },
  async disconnect() {
    await api.disconnectMarketAccount()
  },
  async mine(page = 1) {
    return (await api.listRemoteSubmissions({ page, size: 9 })).data
  },
  async detail(name: string) {
    return (await api.getRemoteSubmission({ name })).data
  },
  async send(draft: SubmissionDraft, target?: { name: string; resourceVersion: number }) {
    const packageJson = JSON.stringify(exportSubmission(draft))
    if (new TextEncoder().encode(packageJson).byteLength > 524288)
      throw new Error('作品包不能超过 512 KiB')
    return target
      ? (
          await api.sendMarketRevision({
            name: target.name,
            marketSubmitRequest: { packageJson, expectedVersion: target.resourceVersion },
          })
        ).data
      : (await api.sendMarketSubmission({ marketSubmitRequest: { packageJson } })).data
  },
  async withdraw(name: string, expectedVersion: number) {
    return (await api.withdrawRemoteSubmission({ name, marketVersionRequest: { expectedVersion } }))
      .data
  },
}
export function marketError(cause: unknown) {
  const response = (cause as { response?: { data?: { detail?: string }; status?: number } })
    ?.response
  if (response?.data?.detail) return response.data.detail
  if (response?.status === 403) return '没有市场操作权限，请联系当前站点管理员授权'
  if (response?.status === 401) return '请登录工作台并连接市场账号'
  return cause instanceof Error ? cause.message : '市场服务暂时不可用，请稍后重试'
}
export function statusLabel(status?: string) {
  return (
    (
      {
        PENDING: '待审核',
        APPROVED: '已通过',
        REJECTED: '已退回',
        WITHDRAWN: '已撤回',
        ARCHIVED: '已归档',
      } as Record<string, string>
    )[status ?? ''] ??
    status ??
    '未知状态'
  )
}
