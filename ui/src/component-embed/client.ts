import { axiosInstance } from '@halo-dev/api-client'
import type { InjectionKey } from 'vue'
import { LinguiEmbedsApi, type EmbedStatus } from '../api/generated'

export interface EmbedClient {
  status(name: string, signal: AbortSignal): Promise<EmbedStatus>
  enable(name: string, signal: AbortSignal): Promise<EmbedStatus>
  disable(name: string, signal: AbortSignal): Promise<EmbedStatus>
}
export const embedClientKey: InjectionKey<EmbedClient> = Symbol('Lingui embed client')
export function createEmbedClient(): EmbedClient {
  const api = new LinguiEmbedsApi(undefined, '', axiosInstance)
  return {
    async status(name, signal) {
      return (await api.getComponentEmbedStatus({ name }, { signal, timeout: 15000 })).data
    },
    async enable(name, signal) {
      return (await api.enableComponentEmbed({ name }, { signal, timeout: 15000 })).data
    },
    async disable(name, signal) {
      return (await api.disableComponentEmbed({ name }, { signal, timeout: 15000 })).data
    },
  }
}
