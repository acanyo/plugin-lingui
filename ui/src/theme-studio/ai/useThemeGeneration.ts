import { onScopeDispose, ref } from 'vue'
import { validateTheme, type ThemeTokens } from '@lingui/renderer'
import type { StudioRepository } from '../../component-library/types'
import { generationError } from '../../ai-adapter/generation-error'
import { ThemeGenerationFormatError, validateGeneratedTheme } from './theme-result'

export function useThemeGeneration(
  repository: StudioRepository,
  current: () => ThemeTokens,
  revision: () => number,
  allowed: () => boolean,
  apply: (theme: ThemeTokens) => void,
) {
  const busy = ref(false)
  const candidate = ref<ThemeTokens>()
  const problem = ref<{ text: string; details: string }>()
  const status = ref('')
  let disposed = false
  onScopeDispose(() => {
    disposed = true
  })

  function accept() {
    if (!candidate.value) return
    apply(candidate.value)
    status.value = `已预览「${candidate.value.name}」，可以继续调整或保存。`
    candidate.value = undefined
  }
  function discard() {
    candidate.value = undefined
    status.value = '已保留当前修改。'
  }
  async function generate(instruction: string) {
    const text = instruction.trim()
    if (disposed || busy.value || candidate.value || !allowed() || !text || text.length > 4000)
      return
    const sourceRevision = revision()
    problem.value = undefined
    status.value = ''
    busy.value = true
    try {
      const source = validateTheme(current())
      const result = validateGeneratedTheme(await repository.generateTheme(text, source))
      delete result.customFont
      if (source.customFont) result.customFont = source.customFont
      if (disposed) return
      candidate.value = result
      if (sourceRevision === revision()) accept()
      else status.value = '生成期间你调整了主题。选择是否使用这次 AI 结果。'
    } catch (cause) {
      if (disposed) return
      problem.value =
        cause instanceof ThemeGenerationFormatError
          ? { text: 'AI 返回的主题格式不完整，请重试或缩小修改范围。', details: cause.message }
          : generationError(cause)
    } finally {
      if (!disposed) busy.value = false
    }
  }
  return { busy, candidate, problem, status, generate, accept, discard }
}
