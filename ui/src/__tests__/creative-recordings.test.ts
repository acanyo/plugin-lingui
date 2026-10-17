import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  createInstance,
  parseSource,
  serializeSource,
  registerInteractionCallback,
  type EventReport,
  type ComponentInstance,
} from '@lingui/renderer'
import {
  document as makeDocument,
  column,
  text,
} from '../../../packages/renderer/src/examples/builders'
import { contractDocument } from './fixtures/response-contract'
import {
  createRecording,
  recordingIssues,
  stepFromReport,
  validateRecording,
  type RecordingStep,
} from '../interaction-recordings/model'
import { createReplay } from '../interaction-recordings/replay'
import { useInteractionRecordings } from '../interaction-recordings/useInteractionRecordings'
import { resumeSnapshot } from '../creation-history/types'
import { shareRecording, validateSharedDemos } from '../interaction-recordings/shared-demo'
import RecordingReplay from '../interaction-recordings/RecordingReplay.vue'
import { defaultScenario, apiTargets } from '../integrations/scenarios/model'

const inputStep = (
  data: unknown,
  component = 'TextField',
  nodeId = 'input',
  event = 'input',
): RecordingStep => ({
  id: crypto.randomUUID(),
  nodeId,
  component,
  event: event as RecordingStep['event'],
  data: data as RecordingStep['data'],
  supported: true,
})
function quiz() {
  return createInstance(
    makeDocument(
      '测验',
      [
        column('root', ['input', 'answer', 'reset', 'result']),
        { id: 'input', component: 'TextField', label: '答案', value: { path: '/answer' } },
        {
          id: 'answer',
          component: 'Button',
          child: 'answer-label',
          action: {
            functionCall: {
              call: 'lingui.dispatch',
              args: { actions: [{ type: 'setState', path: '/shown', value: true }] },
            },
          },
        },
        text('answer-label', '查看解析'),
        {
          id: 'reset',
          component: 'Button',
          child: 'reset-label',
          action: {
            functionCall: { call: 'lingui.dispatch', args: { actions: [{ type: 'reset' }] } },
          },
        },
        text('reset-label', '重新作答'),
        { id: 'result', component: 'Text', text: { path: '/answer' } },
      ],
      { answer: '', shown: false },
    ),
  )
}
const click = (id = 'load') => inputStep({ value: null }, 'Button', id, 'click')
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
describe('recorded interactions remain private and replay in isolated state', () => {
  it('records automatic loading as a replayable step and never starts it again in replay previews', async () => {
    const instance = createInstance(contractDocument())
    const nodes = parseSource(instance.document.source)
    nodes.find((node) => node.id === 'root')!.events = {
      mount: nodes.find((node) => node.id === 'load')!.events!.click!,
    }
    instance.document.source = serializeSource(nodes)
    const step = stepFromReport({
      nodeId: 'root',
      component: 'Column',
      event: 'mount',
      phase: 'start',
      data: null,
    })!
    expect(step.supported).toBe(true)
    const record = createRecording(instance, '打开天气', [step])
    expect(recordingIssues(record, instance)).toEqual([])
    expect(shareRecording(record, instance).steps[0]?.event).toBe('mount')
    const engine = createReplay(instance)
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    const wrapper = mount(RecordingReplay, {
      props: { recording: record },
      attachTo: document.body,
    })
    try {
      expect(engine.state.response).toBeNull()
      await engine.step(step)
      expect(engine.state.response).toMatchObject({ temperature: 21 })
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '单步')!
        .trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('已完成 1 / 1 步')
      expect(wrapper.findAll('[role="alert"]').length).toBe(0)
      expect(network).not.toHaveBeenCalled()
    } finally {
      engine.destroy()
      wrapper.unmount()
    }
  })
  it('records one step per real event, stops at 100, restores its exact snapshot and excludes diagnostic responses', () => {
    let api!: ReturnType<typeof useInteractionRecordings>
    const changed = vi.fn(),
      instance = quiz(),
      reset = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup() {
          api = useInteractionRecordings({ instance: () => instance, changed, reset })
          return () => h('div')
        },
      }),
    )
    const report: EventReport = {
      nodeId: 'input',
      component: 'TextField',
      event: 'input',
      phase: 'start',
      data: { value: 'B', text: 'B' },
      runId: '1',
    }
    api.observe(report)
    expect(api.count.value).toBe(0)
    api.start('做题')
    expect(reset).toHaveBeenCalledOnce()
    api.observe(report)
    api.observe({ ...report, phase: 'success', result: { secret: 'server secret' } })
    api.observe({
      ...report,
      runId: 'action',
      scope: 'request',
      phase: 'success',
      result: { payload: 'private' },
    })
    expect(api.count.value).toBe(1)
    api.stop()
    const recording = api.records.value[0]!
    expect(recording.snapshot).toEqual(instance)
    expect(JSON.stringify(recording)).not.toContain('server secret')
    expect(JSON.stringify(recording)).not.toContain('private')
    const restored = resumeSnapshot({
      instance,
      messages: [],
      instruction: '',
      dirty: true,
      editing: false,
      recordings: [recording],
    })
    expect(restored.recordings?.[0]?.steps[0]?.data).toEqual({ value: 'B', text: 'B' })
    api.start('上限')
    for (let i = 0; i < 101; i++) api.observe({ ...report, runId: String(i) })
    expect(api.recording.value).toBe(false)
    expect(api.records.value[0]!.steps.length).toBe(100)
    wrapper.unmount()
  })
  it('does not persist password or token field inputs or request/header secrets in snapshot', () => {
    let api!: ReturnType<typeof useInteractionRecordings>
    const instance = quiz()
    const nodes = parseSource(instance.document.source)
    nodes.find((n) => n.id === 'input')!.value = { path: '/token' }
    instance.document.source = serializeSource(nodes)
    instance.document.state = { token: 'secret', shown: false, answer: '' }
    const wrapper = mount(
      defineComponent({
        setup() {
          api = useInteractionRecordings({ instance: () => instance, changed: () => {} })
          return () => h('div')
        },
      }),
    )
    api.start('敏感')
    api.observe({
      nodeId: 'input',
      component: 'TextField',
      event: 'input',
      phase: 'start',
      data: { value: 'sensitive' },
      runId: 's',
    })
    api.stop()
    expect(api.records.value[0]!.steps[0]).toMatchObject({ supported: false, data: null })
    expect(JSON.stringify(api.records.value)).not.toContain('sensitive')
    expect(
      stepFromReport({
        nodeId: 'password',
        component: 'LingUI.PasswordInput',
        event: 'input',
        data: { value: 'hidden' },
        phase: 'start',
      })?.data,
    ).toBeNull()
    wrapper.unmount()
  })
  it('redacts obscured TextField defaults and marks their recorded inputs unsupported', () => {
    const instance = quiz(),
      nodes = parseSource(instance.document.source)
    nodes.find((node) => node.id === 'input')!.variant = 'obscured'
    instance.document.source = serializeSource(nodes)
    instance.document.state.answer = 'original-hidden-value'
    const before = JSON.stringify(instance),
      recording = createRecording(instance, '密码输入')
    expect(JSON.stringify(recording)).not.toContain('original-hidden-value')
    expect(recording.snapshot.document.state.answer).toBe('')
    expect(JSON.stringify(instance)).toBe(before)
    expect(() =>
      shareRecording(
        { ...recording, steps: [inputStep({ value: 'typed-hidden-value' })] },
        instance,
      ),
    ).toThrow('不匹配')
  })
  it('replays input → action → reset without mutating the author design, and invalidates deleted targets', async () => {
    const instance = quiz(),
      before = JSON.stringify(instance),
      engine = createReplay(instance)
    await engine.step(inputStep({ value: 'B', text: 'B' }))
    await engine.step(click('answer'))
    expect(engine.state).toEqual({ answer: 'B', shown: true })
    expect(engine.view().document.state).toEqual(engine.state)
    expect(engine.view().document.parameters).toEqual([])
    await engine.step(click('reset'))
    expect(engine.state).toEqual({ answer: '', shown: false })
    expect(JSON.stringify(instance)).toBe(before)
    engine.destroy()
    await expect(engine.step(click('answer'))).rejects.toThrow('已停止')
    const record = createRecording(instance, '做题', [click('answer')])
    const empty = quiz()
    empty.document.source = serializeSource([column('root', [])])
    expect(recordingIssues(record, empty)[0]!.message).toContain('已不存在')
    expect(() =>
      validateRecording({ ...record, steps: [{ ...record.steps[0], event: 'unknown' }] }),
    ).toThrow()
  })
  it('mocks APIs, blocks missing samples and registered callbacks, and can reproduce 503 then retry with success', async () => {
    const instance = createInstance(contractDocument()),
      network = vi.fn(() => {
        throw new Error('network forbidden')
      })
    vi.stubGlobal('fetch', network)
    const engine = createReplay(instance)
    await engine.step(click())
    expect(engine.state.response).toEqual({ temperature: 21, items: [{ name: '今天', value: 1 }] })
    engine.destroy()
    expect(network).not.toHaveBeenCalled()
    const api = instance.document.integrations!.apis[0]!
    delete api.responseExample
    const missing = createReplay(instance)
    await expect(missing.step(click())).rejects.toThrow('缺少接口演示响应')
    missing.destroy()
    expect(network).not.toHaveBeenCalled()
    const rule = defaultScenario(apiTargets(instance.document)[0]!)
    rule.mode = 'failure'
    const key = apiTargets(instance.document)[0]!.key,
      rules = { [key]: rule },
      retry = createReplay(instance, rules)
    await expect(retry.step(click())).rejects.toThrow()
    rule.mode = 'success'
    rule.success = { temperature: 30 }
    await retry.step(click())
    expect(retry.state.response).toEqual({ temperature: 30 })
    retry.destroy()
  })
  it('simulates a registered host callback and cancels delayed actions before any state write', async () => {
    const instance = quiz(),
      nodes = parseSource(instance.document.source)
    const answer = nodes.find((node) => node.id === 'answer')!
    delete answer.action
    answer.events = {
      click: {
        actions: [
          { type: 'callback', name: 'test.host', args: { value: 'demo' }, resultPath: '/callback' },
        ],
      },
    }
    instance.document.source = serializeSource(nodes)
    const callback = vi.fn(() => {
      throw new Error('host must stay isolated')
    })
    const unregister = registerInteractionCallback('test.host', callback)
    const engine = createReplay(instance)
    try {
      await engine.step(click('answer'))
      expect(engine.state.callback).toEqual({ value: 'demo' })
      expect(callback).not.toHaveBeenCalled()
    } finally {
      engine.destroy()
      unregister()
    }
    answer.events = {
      click: {
        actions: [
          { type: 'delay', ms: 200 },
          { type: 'local', actions: [{ type: 'setState', path: '/shown', value: true }] },
        ],
      },
    }
    instance.document.source = serializeSource(nodes)
    const delayed = createReplay(instance)
    const task = delayed.step(click('answer'))
    const cancelled = expect(task).rejects.toMatchObject({ name: 'AbortError' })
    delayed.destroy()
    await cancelled
    expect(delayed.state.shown).toBe(false)
  })
  it('requires explicit curated data, rejects stale/malformed public demos, and strips all diagnostic fields', () => {
    const instance = quiz(),
      record = createRecording(instance, '做题', [inputStep({ value: 'B' }), click('answer')])
    const demo = shareRecording(record, instance)
    expect(demo.steps.length).toBe(2)
    expect('snapshot' in demo).toBe(false)
    const changed = shareRecording(
      createRecording(instance, '实际输入', [
        inputStep(
          { value: 'B', previousValue: '', path: '/answer' },
          'TextField',
          'input',
          'change',
        ),
      ]),
      instance,
    )
    expect(changed.steps[0]!.data).toEqual({ value: 'B' })
    expect(() =>
      validateSharedDemos(
        [{ ...demo, steps: [{ ...demo.steps[0], data: { authorization: 'Bearer secret' } }] }],
        instance,
      ),
    ).toThrow()
    expect(() =>
      validateSharedDemos(
        [{ ...demo, steps: [{ ...demo.steps[0], component: 'LingUI.PasswordInput' }] }],
        instance,
      ),
    ).toThrow()
    expect(() =>
      validateSharedDemos(
        [{ ...demo, steps: [{ ...demo.steps[0], nodeId: 'missing' }] }],
        instance,
      ),
    ).toThrow('不匹配')
  })
  it('single-steps and resets an isolated preview and reports failing step rather than changing the live work', async () => {
    const instance = quiz(),
      record = createRecording(instance, '做题', [inputStep({ value: 'B' }), click('answer')]),
      before = JSON.stringify(instance)
    const wrapper = mount(RecordingReplay, { props: { recording: record, current: instance } })
    const press = async (label: string) => {
      const button = wrapper.findAll('button').find((b) => b.text() === label)!
      await button.trigger('click')
      await flushPromises()
    }
    await press('单步')
    expect(wrapper.text()).toContain('已完成 1 / 2 步')
    await press('单步')
    expect(wrapper.text()).toContain('已完成 2 / 2 步')
    expect(JSON.stringify(instance)).toBe(before)
    await press('重置')
    expect(wrapper.text()).toContain('已完成 0 / 2 步')
    wrapper.unmount()
  })
})
