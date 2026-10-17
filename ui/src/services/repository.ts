import { inject, type InjectionKey } from 'vue'
import type { StudioRepository } from '../component-library/types'
export const repositoryKey: InjectionKey<StudioRepository> = Symbol('LingUI Repository')
export function useRepository(): StudioRepository {
  const repository = inject(repositoryKey)
  if (!repository) throw new Error('组件库尚未连接')
  return repository
}
export function errorMessage(error: unknown): string {
  const response = (
    error as { response?: { data?: { detail?: string; title?: string }; status?: number } }
  )?.response
  if (response?.status === 403) return '没有管理灵构 UI 的权限，请联系管理员授权'
  if (response?.status === 409) return '组件已被其他窗口修改，请刷新组件库后重试'
  return response?.data?.detail ?? (error instanceof Error ? error.message : '操作失败，请稍后重试')
}
