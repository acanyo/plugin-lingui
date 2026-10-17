import { axiosInstance } from '@halo-dev/api-client'
import {
  LinguiMcpHistoryApi,
  type DraftInfo,
  type DraftDetail,
  type ActivityInfo,
} from '../../api/generated'

export type { DraftInfo, DraftDetail, ActivityInfo }
export interface McpHistoryClient {
  drafts(): Promise<DraftInfo[]>
  activities(): Promise<ActivityInfo[]>
  get(id: string): Promise<DraftDetail>
  loaded(id: string): Promise<void>
  delete(id: string): Promise<void>
}
export function createMcpHistoryClient(): McpHistoryClient {
  const api = new LinguiMcpHistoryApi(undefined, '', axiosInstance)
  return {
    async drafts() {
      return (await api.listMcpDrafts()).data.items ?? []
    },
    async activities() {
      return (await api.listMcpActivities()).data.items ?? []
    },
    async get(id) {
      return (await api.getMcpDraft({ name: id })).data
    },
    async loaded(id) {
      await api.markMcpDraftLoaded({ name: id })
    },
    async delete(id) {
      await api.deleteMcpDraft({ name: id })
    },
  }
}
