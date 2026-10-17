import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createInstance, builtInThemes, type ComponentInstance } from '@lingui/renderer'
import { column, document, text } from '../../../packages/renderer/src/examples/builders'
import { useDesignCandidates } from '../design-candidates/useDesignCandidates'
import { combineCandidateTheme, validateCandidateSet } from '../design-candidates/model'
import { resumeSnapshot } from '../creation-history/types'
import type { StudioRepository } from '../component-library/types'
const design = (title: string) => document(title, [column('root', ['text']), text('text', title)])
afterEach(() => vi.restoreAllMocks())
function setup(current: ComponentInstance | undefined = createInstance(design('原作'))) {
  const generate = vi.fn<StudioRepository['generate']>(),
    changed = vi.fn(),
    busy = vi.fn()
  let api!: ReturnType<typeof useDesignCandidates>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useDesignCandidates({ generate, current: () => current, changed, busy })
        return () => h('div')
      },
    }),
  )
  return { api, generate, changed, busy, wrapper, current }
}
describe('independent sequential design candidates', () => {
  it('waits for one candidate before the next, retains partial success, allows independent retry and explicit third request', async () => {
    const { api, generate, wrapper, current } = setup()
    const before = JSON.stringify(current)
    let first!: (value: ReturnType<typeof design>) => void
    generate
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve
          }),
      )
      .mockRejectedValueOnce(new Error('provider failed'))
      .mockResolvedValueOnce(design('第二案重试'))
      .mockResolvedValueOnce(design('第三案'))
    const run = api.start('做一张知识卡')
    await flushPromises()
    expect(generate).toHaveBeenCalledTimes(1)
    expect(api.set.value?.candidates.map((row) => row.status)).toEqual(['running', 'queued'])
    first(design('第一案'))
    await run
    expect(api.set.value?.candidates.map((row) => row.status)).toEqual(['done', 'error'])
    expect(api.set.value?.candidates[0]!.instance?.document.title).toBe('第一案')
    expect(JSON.stringify(current)).toBe(before)
    await api.retry(api.set.value!.candidates[1]!.id)
    expect(api.set.value?.candidates.map((row) => row.status)).toEqual(['done', 'done'])
    await api.third()
    expect(generate).toHaveBeenCalledTimes(4)
    expect(api.set.value!.candidates).toHaveLength(3)
    await api.third()
    expect(generate).toHaveBeenCalledTimes(4)
    wrapper.unmount()
  })
  it('cancels a queued or active candidate without erasing successful alternatives and never adopts a late result', async () => {
    const { api, generate, wrapper } = setup()
    let finish!: (value: ReturnType<typeof design>) => void
    generate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const run = api.start('生成')
    await flushPromises()
    const [a, b] = api.set.value!.candidates
    api.cancel(b!.id)
    api.cancel(a!.id)
    finish(design('迟到结果'))
    await run
    expect(generate).toHaveBeenCalledTimes(1)
    expect(
      api.set.value!.candidates.every((row) => row.status === 'stopped' && !row.instance),
    ).toBe(true)
    generate.mockResolvedValueOnce(design('取消后重试'))
    await api.retry(a!.id)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(api.set.value!.candidates[0]!.instance?.document.title).toBe('取消后重试')
    expect(api.set.value!.candidates[1]!.status).toBe('stopped')
    wrapper.unmount()
  })
  it('preserves an explicit existing theme and configured API across candidates and supports explicit token-only combinations', async () => {
    const { api, generate, wrapper, current } = setup()
    current!.theme = builtInThemes[1]!
    current!.document.integrations = {
      apis: [
        {
          name: 'weather',
          url: 'https://example.com/weather',
          label: '天气',
          method: 'GET',
          responseExample: { ok: true },
        },
      ],
      callbacks: [],
    }
    generate.mockResolvedValue({ document: design('候选'), theme: builtInThemes[2]! })
    await api.start('布局比较')
    expect(api.set.value!.candidates[0]!.instance!.theme).toEqual(current!.theme)
    expect(api.set.value!.candidates[0]!.instance!.document.integrations?.apis[0]?.url).toBe(
      'https://example.com/weather',
    )
    const a = createInstance(design('布局'), builtInThemes[0]),
      b = createInstance(design('颜色'), builtInThemes[2])
    const mixed = combineCandidateTheme(a, b)
    expect(mixed.document).toEqual(a.document)
    expect(mixed.parameters).toEqual(a.parameters)
    expect(mixed.theme.colors).toEqual(b.theme.colors)
    expect(mixed.theme.spacing).toBe(a.theme.spacing)
    wrapper.unmount()
  })
  it('restores successful candidates and marks interrupted tasks retryable in validated creation history', () => {
    const candidates = validateCandidateSet({
      id: 'set',
      prompt: '需求',
      candidates: [
        { id: 'a', direction: '紧凑', status: 'done', instance: createInstance(design('完成')) },
        { id: 'b', direction: '舒展', status: 'running' },
      ],
    })
    const restored = resumeSnapshot({
      messages: [],
      instruction: '',
      dirty: false,
      editing: false,
      candidates,
    })
    expect(restored.candidates!.candidates[0]!.status).toBe('done')
    expect(restored.candidates!.candidates[1]!.status).toBe('stopped')
  })
})
