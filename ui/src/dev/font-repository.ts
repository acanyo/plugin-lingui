import { validateFontFamily } from '@lingui/renderer'
import type { ManagedFont } from '../font-library/types'
import { localOperation } from './database'
type StoredFont = ManagedFont & { id: string }
export function createLocalFontRepository() {
  return {
    async listFonts() {
      const fonts = await localOperation<StoredFont[]>('fonts', 'readonly', (store) =>
        store.getAll(),
      )
      return fonts.map(({ id: _id, ...font }) => ({
        ...font,
        definition: validateFontFamily(font.definition),
      }))
    },
    async saveFont(font: ManagedFont) {
      const safe = { ...font, definition: validateFontFamily(font.definition) }
      const existing = await localOperation<StoredFont | undefined>('fonts', 'readonly', (store) =>
        store.get(safe.definition.id),
      )
      if (existing && existing.versionToken !== safe.versionToken)
        throw new Error('字体已被其他窗口修改，请刷新后重试')
      safe.versionToken = (existing?.versionToken ?? 0) + 1
      await localOperation('fonts', 'readwrite', (store) =>
        store.put({ ...safe, id: safe.definition.id }),
      )
      return safe
    },
    async deleteFont(id: string) {
      await localOperation('fonts', 'readwrite', (store) => store.delete(id))
    },
  }
}
