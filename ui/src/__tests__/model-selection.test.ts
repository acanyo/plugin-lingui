import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { axiosInstance } from '@halo-dev/api-client'
import { examples, pureTheme } from '@lingui/renderer'
import { modelPreferenceKey, useModelSelection } from '../model-selection/useModelSelection'
import { withModelSelection } from '../model-selection/repository'
import { createHaloRepository } from '../services/halo-repository'

let effects: EffectScope[] = []
afterEach(() => {
  effects.forEach((scope) => scope.stop())
  effects = []
  localStorage.clear()
  vi.restoreAllMocks()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function setup(loadDefault = vi.fn().mockResolvedValue({ modelName: 'legacy-model' })) {
  const scope = ref<string | undefined>('halo:alice')
  const enabled = ref(true)
  const effect = effectScope()
  effects.push(effect)
  const selection = effect.run(() => useModelSelection({ scope, enabled, loadDefault }))!
  return { selection, scope, enabled, loadDefault, effect }
}

describe('workbench model preferences', () => {
  it('initializes from the legacy setting before the first generation and persists the choice', async () => {
    const pending = deferred<{ modelName: string }>()
    const { selection, loadDefault } = setup(vi.fn().mockReturnValue(pending.promise))
    let resolved = false
    const first = selection.forGeneration().then((value) => {
      resolved = true
      return value
    })
    await flushPromises()
    expect(selection.loading.value).toBe(true)
    expect(resolved).toBe(false)
    pending.resolve({ modelName: 'legacy-model' })
    await expect(first).resolves.toBe('legacy-model')
    expect(loadDefault).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(modelPreferenceKey('halo:alice'))!)).toBe('legacy-model')
    selection.select('other-model')
    expect(await selection.forGeneration()).toBe('other-model')
  })
  it('keeps an explicitly cleared default through remounts and isolates other Halo accounts', async () => {
    const first = setup()
    await flushPromises()
    first.selection.select(undefined)
    expect(await first.selection.forGeneration()).toBe('')
    first.effect.stop()
    const next = setup()
    await flushPromises()
    expect(next.loadDefault).not.toHaveBeenCalled()
    expect(await next.selection.forGeneration()).toBe('')
    next.scope.value = 'halo:bob'
    await flushPromises()
    expect(await next.selection.forGeneration()).toBe('legacy-model')
    next.selection.select('bob-model')
    next.scope.value = 'halo:alice'
    expect(await next.selection.forGeneration()).toBe('')
  })
  it('discards stale default responses and rejects queued generation after the account changes', async () => {
    const alice = deferred<{ modelName: string }>()
    const bob = deferred<{ modelName: string }>()
    const { selection, scope } = setup(
      vi.fn().mockReturnValueOnce(alice.promise).mockReturnValueOnce(bob.promise),
    )
    const first = selection.forGeneration()
    const rejected = expect(first).rejects.toThrow('账号已变化')
    scope.value = 'halo:bob'
    bob.resolve({ modelName: 'bob-model' })
    await flushPromises()
    alice.resolve({ modelName: 'alice-model' })
    await rejected
    expect(await selection.forGeneration()).toBe('bob-model')
    expect(localStorage.getItem(modelPreferenceKey('halo:alice'))).toBeNull()
  })
  it('allows a failed default load to retry or accept an explicit selection', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ modelName: 'recovered' })
    const { selection } = setup(load)
    await flushPromises()
    expect(selection.ready.value).toBe(true)
    expect(selection.error.value).toContain('重试载入')
    expect(await selection.forGeneration()).toBeUndefined()
    selection.retry()
    await flushPromises()
    expect(await selection.forGeneration()).toBe('recovered')
    expect(selection.error.value).toBe('')
    selection.select(undefined)
    expect(await selection.forGeneration()).toBe('')
  })
  it('waits for identity, avoids requests without AI permission, and fixes the model during generation', async () => {
    const { selection, scope, enabled, loadDefault } = setup()
    await flushPromises()
    const release = selection.acquire()
    selection.select('changed-in-flight')
    expect(await selection.forGeneration()).toBe('legacy-model')
    release()
    selection.select('selected')
    expect(await selection.forGeneration()).toBe('selected')
    scope.value = undefined
    expect(selection.ready.value).toBe(false)
    await expect(selection.forGeneration()).rejects.toThrow('确认当前账号')
    enabled.value = false
    scope.value = 'halo:charlie'
    await flushPromises()
    expect(loadDefault).toHaveBeenCalledTimes(1)
  })
  it('stays usable when browser persistence is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { selection } = setup()
    await flushPromises()
    selection.select('session-model')
    expect(await selection.forGeneration()).toBe('session-model')
    expect(selection.persistenceError.value).toContain('无法保存偏好')
  })
})

describe('model selection request contracts', () => {
  it('uses the generated endpoint for the legacy default', async () => {
    const request = vi
      .spyOn(axiosInstance, 'request')
      .mockResolvedValue({ data: { modelName: 'legacy' } })
    await expect(createHaloRepository().getGenerationSettings!()).resolves.toEqual({
      modelName: 'legacy',
    })
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/apis/console.api.lingui.acanyo.com/v1alpha1/generation-settings',
      }),
    )
  })
  it.each([undefined, '', 'chosen-model'])(
    'sends the selected model in JSON and theme requests: %s',
    async (modelName) => {
      const document = examples[0]!.create()
      const request = vi
        .spyOn(axiosInstance, 'request')
        .mockResolvedValueOnce({ data: { content: JSON.stringify(document) } })
        .mockResolvedValueOnce({ data: { content: JSON.stringify(pureTheme) } })
      const repository = createHaloRepository()
      await repository.generate('组件', undefined, { modelName })
      await repository.generateTheme('主题', pureTheme, { modelName })
      const componentBody = JSON.parse(request.mock.calls[0]![0].data as string)
      const themeBody = JSON.parse(request.mock.calls[1]![0].data as string)
      expect(componentBody.modelName).toBe(modelName)
      expect(themeBody.modelName).toBe(modelName)
      expect(Object.hasOwn(componentBody, 'modelName')).toBe(modelName !== undefined)
      expect(Object.hasOwn(themeBody, 'modelName')).toBe(modelName !== undefined)
    },
  )
  it('uses the same selected model for streaming requests and preserves cancellation and progress', async () => {
    const document = examples[0]!.create()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: 'result',
              elapsedMs: 1,
              content: JSON.stringify(document),
            })}\n\n`,
          ),
        )
        controller.close()
      },
    })
    const request = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      data: stream,
      headers: { 'content-type': 'text/event-stream' },
    })
    const signal = new AbortController().signal
    const onProgress = vi.fn()
    const selected = withModelSelection(createHaloRepository(), { forGeneration: async () => '' })
    await selected.generate('组件', undefined, { signal, onProgress })
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: 'fetch',
        responseType: 'stream',
        signal,
        data: JSON.stringify({ instruction: '组件', modelName: '' }),
      }),
    )
  })
})
