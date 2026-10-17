import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createInstance, parseSource, type EventBinding, type EventReport } from '@lingui/renderer'
import { contractDocument } from './fixtures/response-contract'
import EventEditor from '../component-studio/EventEditor.vue'
import InteractionGraph from '../interaction-graph/InteractionGraph.vue'
import { graphReportsKey } from '../interaction-graph/context'
import { computed } from 'vue'
import { moveGraphAction, replaceGraphAction, graphStepReport } from '../interaction-graph/model'
const binding: EventBinding = {
  actions: [
    { type: 'api', name: 'weather', args: { city: '北京' }, resultPath: '/weather' },
    { type: 'callback', name: 'lingui.log', args: { $state: '/weather' } },
  ],
  onSuccess: [{ type: 'local', actions: [{ type: 'setState', path: '/message', value: '成功' }] }],
  onError: [{ type: 'local', actions: [{ type: 'setState', path: '/message', value: '失败' }] }],
  loadingPath: '/loading',
  errorPath: '/error',
}
describe('interaction graph edits the existing event definition', () => {
  it('moves and removes steps without losing branch definitions, callback args or state paths; blocks invalid links', () => {
    const original = JSON.stringify(binding),
      moved = moveGraphAction(binding, 'actions', 1, -1)
    expect(moved.actions[0]).toEqual(binding.actions[1])
    expect(moved.onSuccess).toEqual(binding.onSuccess)
    expect(moved.onError).toEqual(binding.onError)
    expect(moved.loadingPath).toBe('/loading')
    expect(JSON.stringify(binding)).toBe(original)
    expect(moveGraphAction(binding, 'actions', 0, -1)).toEqual(binding)
    expect(replaceGraphAction(binding, 'onError', -1)).toEqual(binding)
    expect(replaceGraphAction(binding, 'actions', 0).actions).toEqual([binding.actions[1]])
  })
  it('switches graph ↔ form, edits request parameters and saves exactly one complete event model', async () => {
    const document = contractDocument(),
      node = parseSource(document.source).find((node) => node.id === 'load')!
    node.events = { click: binding }
    const wrapper = mount(EventEditor, { props: { node, document } })
    const press = async (name: string) => {
      const button = wrapper.findAll('button').find((row) => row.text() === name)!
      await button.trigger('click')
    }
    await press('交互图')
    expect(wrapper.findComponent(InteractionGraph).exists()).toBe(true)
    const graph = wrapper.getComponent(InteractionGraph)
    graph.vm.$emit('update', {
      ...binding,
      actions: [
        {
          type: 'request',
          url: 'https://example.com/search',
          method: 'POST',
          body: { $state: '/city' },
          resultPath: '/response',
        },
      ],
    })
    await press('表单')
    expect(wrapper.findComponent(InteractionGraph).exists()).toBe(false)
    await press('交互图')
    expect(wrapper.getComponent(InteractionGraph).props('binding').actions[0]).toMatchObject({
      body: { $state: '/city' },
    })
    await press('保存事件配置')
    expect(wrapper.emitted('update')?.[0]?.[0]).toMatchObject({
      events: {
        click: {
          loadingPath: '/loading',
          onError: binding.onError,
          onSuccess: binding.onSuccess,
          actions: [{ type: 'request', body: { $state: '/city' } }],
        },
      },
    })
    wrapper.unmount()
  })
  it('highlights the latest run only and retains error position and duration', () => {
    const reports: EventReport[] = [
      {
        nodeId: 'load',
        component: 'Button',
        event: 'click',
        data: null,
        phase: 'error',
        runId: 'old',
        scope: 'action',
        branch: 'actions',
        step: 1,
        error: 'old',
      },
      {
        nodeId: 'load',
        component: 'Button',
        event: 'click',
        data: null,
        phase: 'success',
        runId: 'new',
        scope: 'action',
        branch: 'actions',
        step: 1,
        durationMs: 12,
      },
    ]
    expect(graphStepReport(reports, 'actions', 0)?.phase).toBe('success')
    expect(graphStepReport(reports, 'onError', 0)).toBeUndefined()
    const wrapper = mount(InteractionGraph, {
      props: { binding, nodeId: 'load', event: 'click', reports },
    })
    expect(wrapper.find('[data-phase="success"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('12 ms')
    wrapper.unmount()
  })
})
