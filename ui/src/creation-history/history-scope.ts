import { computed } from 'vue'
import { stores } from '@halo-dev/ui-shared'
/** IndexedDB is already isolated by site; do not share private conversations between Halo accounts. */
export function useHistoryScope(mode: 'halo' | 'local') {
  if (mode === 'local') return computed(() => 'local')
  try {
    const user = stores.currentUser()
    return computed(() => {
      const name = user.currentUser?.user.metadata.name
      return name && name !== 'anonymousUser' ? `halo:${name}` : undefined
    })
  } catch {
    return computed(() => undefined)
  }
}
