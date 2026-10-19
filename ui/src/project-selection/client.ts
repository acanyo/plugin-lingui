import { axiosInstance } from '@halo-dev/api-client'
import type { InjectionKey } from 'vue'
import {
  LinguiProjectsApi,
  type ProjectOption,
  type ProjectOptionList,
} from '../api/project-selection'

export type ProjectOptionsQuery = Parameters<LinguiProjectsApi['listLinguiProjectOptions']>[0]

/** A read-only boundary shared by the Vue selector and its FormKit adapter. */
export interface ProjectSelectionClient {
  list(query: ProjectOptionsQuery, signal: AbortSignal): Promise<ProjectOptionList>
  get(name: string, publicOnly: boolean, signal: AbortSignal): Promise<ProjectOption>
}

export const projectSelectionClientKey: InjectionKey<ProjectSelectionClient> = Symbol(
  'Lingui project selection client',
)

export function createProjectSelectionClient(): ProjectSelectionClient {
  const api = new LinguiProjectsApi(undefined, '', axiosInstance)
  return {
    async list(query, signal) {
      return (await api.listLinguiProjectOptions(query, { signal, timeout: 15000 })).data
    },
    async get(name, publicOnly, signal) {
      return (await api.getLinguiProjectOption({ name, publicOnly }, { signal, timeout: 15000 }))
        .data
    },
  }
}
