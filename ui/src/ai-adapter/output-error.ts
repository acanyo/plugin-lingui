/** Distinguishes a returned but invalid design from provider/network failures. */
export class GenerationOutputError extends Error {
  constructor(readonly problem: unknown) {
    super(problem instanceof Error ? problem.message : 'AI 返回的设计格式无效')
  }
}
/** A usable document was returned, but isolated interaction checks still failed. */
export class GenerationCheckError extends GenerationOutputError {}
