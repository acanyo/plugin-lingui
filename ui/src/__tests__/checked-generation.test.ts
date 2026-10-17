import { describe, expect, it, vi } from 'vitest'
import { createInstance, pureTheme, type LinguiDocument } from '@lingui/renderer'
import { column, document, text } from '../../../packages/renderer/src/examples/builders'
import type { StudioRepository } from '../component-library/types'
import { generateCheckedDesign, CheckedGenerationError } from '../ai-adapter/checked-generation'
import { GenerationOutputError, GenerationCheckError } from '../ai-adapter/output-error'

function calculator(min: number) {
  return document(
    '计算器',
    [
      column('root', ['input', 'result']),
      {
        id: 'input',
        component: 'LingUI.NumberInput',
        label: '除数',
        min,
        max: 10,
        value: { path: '/divisor' },
      },
      {
        ...text('result', ''),
        text: {
          call: 'lingui.evaluate',
          args: { expression: { op: 'divide', args: [10, { path: '/divisor' }] } },
        },
      },
    ],
    { divisor: 2 },
  )
}
function setup() {
  const generate = vi.fn<StudioRepository['generate']>()
  const controller = new AbortController()
  const activity = vi.fn(),
    attempt = vi.fn()
  const options = {
    prompt: '生成一个计算器',
    generate,
    signal: controller.signal,
    activity,
    attempt,
    progress: vi.fn(),
  }
  return { generate, controller, options, activity, attempt }
}
describe('bounded checked generation', () => {
  it('repairs twice against the latest draft and retains its theme without changing the source', async () => {
    const { generate, options, activity, attempt } = setup()
    const source = createInstance(calculator(1)),
      before = JSON.stringify(source)
    const theme = { ...pureTheme, id: 'my-style', name: '我的样式', radius: 0 }
    generate
      .mockResolvedValueOnce({ document: calculator(0), theme })
      .mockResolvedValueOnce(calculator(0))
      .mockResolvedValueOnce(calculator(1))
    const result = await generateCheckedDesign({ ...options, source, context: source.document })
    expect(result.repairs).toBe(2)
    expect(result.design.theme).toEqual(theme)
    expect(result.report.cases.every((row) => row.status === 'passed')).toBe(true)
    expect(attempt.mock.calls.map(([round]) => round)).toEqual([0, 1, 2])
    expect(activity).toHaveBeenCalledWith('repair', '自动修复 · 第 2/2 轮')
    expect(generate.mock.calls[1]![1]).toEqual(calculator(0))
    expect(generate.mock.calls[2]![1]).toEqual(calculator(0))
    expect(JSON.stringify(source)).toBe(before)
  })
  it('uses the same budget for malformed output and runtime errors, preserving the last valid draft', async () => {
    const { generate, options } = setup()
    const invalid = { title: '不完整' } as LinguiDocument
    generate
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(calculator(0))
      .mockResolvedValueOnce(invalid)
    const error = await generateCheckedDesign(options).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(CheckedGenerationError)
    expect((error as CheckedGenerationError).draft?.document).toEqual(calculator(0))
    expect(
      (error as CheckedGenerationError).report?.issues.some(
        (issue) => issue.message === '除数不能为零',
      ),
    ).toBe(true)
    expect(generate).toHaveBeenCalledTimes(3)
    expect(generate.mock.calls.every(([prompt]) => prompt.length <= 4000)).toBe(true)
  })
  it('stops after two unsuccessful repairs and supplies diagnostics with the failed draft', async () => {
    const { generate, options } = setup()
    generate.mockResolvedValue(calculator(0))
    const error = (await generateCheckedDesign(options).catch(
      (cause: unknown) => cause,
    )) as CheckedGenerationError
    expect(generate).toHaveBeenCalledTimes(3)
    expect(error.problem).toBeInstanceOf(GenerationCheckError)
    expect(error.draft?.document).toEqual(calculator(0))
  })
  it('does not retry a transport failure, including a failure during repair', async () => {
    const { generate, options } = setup()
    const failure = new Error('HTTP 502')
    generate.mockRejectedValue(failure)
    await expect(generateCheckedDesign(options)).rejects.toMatchObject({
      problem: failure,
      draft: undefined,
    })
    expect(generate).toHaveBeenCalledTimes(1)
    generate.mockReset().mockResolvedValueOnce(calculator(0)).mockRejectedValue(failure)
    await expect(generateCheckedDesign(options)).rejects.toMatchObject({
      problem: failure,
      draft: { document: calculator(0) },
    })
    expect(generate).toHaveBeenCalledTimes(2)
  })
  it('ignores a late repair result after cancellation and sends no further requests', async () => {
    const { generate, controller, options } = setup()
    generate
      .mockResolvedValueOnce(calculator(0))
      .mockImplementationOnce(async (_prompt, _context, request) => {
        expect(request?.signal).toBe(controller.signal)
        controller.abort()
        return calculator(1)
      })
    await expect(generateCheckedDesign(options)).rejects.toMatchObject({ name: 'AbortError' })
    expect(generate).toHaveBeenCalledTimes(2)
  })
  it('repairs repository parsing failures without inventing a previewable draft', async () => {
    const { generate, options } = setup()
    generate.mockRejectedValue(new GenerationOutputError(new Error('JSON 不完整')))
    const error = (await generateCheckedDesign(options).catch(
      (cause: unknown) => cause,
    )) as CheckedGenerationError
    expect(generate).toHaveBeenCalledTimes(3)
    expect(error.draft).toBeUndefined()
  })
})
