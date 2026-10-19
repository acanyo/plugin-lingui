import type { StudioRepository } from '../component-library/types'
import type { ModelSelection } from './useModelSelection'

/** All workbench generation paths use this explicit scope, including candidates and repairs. */
export function withModelSelection(
  repository: StudioRepository,
  selection: Pick<ModelSelection, 'forGeneration'>,
): StudioRepository {
  return {
    ...repository,
    async generate(instruction, document, options) {
      const modelName = await selection.forGeneration()
      if (options?.signal?.aborted) throw new DOMException('已停止生成', 'AbortError')
      return repository.generate(instruction, document, {
        ...options,
        ...(modelName !== undefined ? { modelName } : {}),
      })
    },
    async generateTheme(instruction, theme, options) {
      const modelName = await selection.forGeneration()
      if (options?.signal?.aborted) throw new DOMException('已停止生成', 'AbortError')
      return repository.generateTheme(instruction, theme, {
        ...options,
        ...(modelName !== undefined ? { modelName } : {}),
      })
    },
  }
}
