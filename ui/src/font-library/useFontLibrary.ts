import { onMounted, onScopeDispose, ref } from 'vue'
import { Dialog } from '@halo-dev/components'
import { useRepository, errorMessage } from '../services/repository'
import type { ManagedFont } from './types'
export function useFontLibrary() {
  const repository = useRepository()
  const fonts = ref<ManagedFont[]>([]),
    loading = ref(true),
    busy = ref(false),
    error = ref('')
  let disposed = false
  let refreshId = 0
  onScopeDispose(() => {
    disposed = true
  })
  async function refresh() {
    if (disposed || busy.value) return
    const id = ++refreshId
    loading.value = true
    try {
      const result = await repository.listFonts()
      if (!disposed && id === refreshId) {
        fonts.value = result
        error.value = ''
      }
    } catch (cause) {
      if (!disposed && id === refreshId) error.value = errorMessage(cause)
    } finally {
      if (!disposed && id === refreshId) loading.value = false
    }
  }
  async function save(font: ManagedFont): Promise<boolean> {
    if (busy.value || loading.value || disposed) return false
    busy.value = true
    try {
      const saved = await repository.saveFont(font)
      if (disposed) return false
      fonts.value = [
        ...fonts.value.filter((item) => item.definition.id !== saved.definition.id),
        saved,
      ]
      error.value = ''
      return true
    } catch (cause) {
      if (!disposed) error.value = errorMessage(cause)
      return false
    } finally {
      if (!disposed) busy.value = false
    }
  }
  function remove(font: ManagedFont) {
    if (busy.value || loading.value || disposed) return
    Dialog.warning({
      title: `移除字体“${font.definition.name}”？`,
      description: '从字体库移除。已保存的主题和作品保留字体配置快照；字体源文件不会被删除。',
      confirmText: '移除字体',
      cancelText: '取消',
      onConfirm: async () => {
        busy.value = true
        try {
          await repository.deleteFont(font.definition.id)
          if (!disposed) {
            fonts.value = fonts.value.filter((item) => item.definition.id !== font.definition.id)
            error.value = ''
          }
        } catch (cause) {
          if (!disposed) error.value = errorMessage(cause)
        } finally {
          if (!disposed) busy.value = false
        }
      },
    })
  }
  onMounted(refresh)
  return { fonts, loading, busy, error, refresh, save, remove }
}
