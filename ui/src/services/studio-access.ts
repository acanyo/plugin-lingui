import { utils } from '@halo-dev/ui-shared'
import { useRepository } from './repository'
import type { StudioRepository } from '../component-library/types'

export type StudioPermission = 'components:manage' | 'themes:manage' | 'ai:generate' | 'mcp:use'

/** Halo remains authoritative; local studios only have local persistence permissions. */
export function useStudioAccess() {
  return studioAccess(useRepository())
}

export function studioAccess(repository: StudioRepository) {
  function allows(scope: StudioPermission): boolean {
    if (repository.mode === 'local') return scope !== 'ai:generate' && scope !== 'mcp:use'
    try {
      return utils.permission.has([`plugin:plugin-lingui:${scope}`])
    } catch {
      return false
    }
  }
  return { allows }
}
