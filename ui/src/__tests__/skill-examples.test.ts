import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  serializeSource,
  validateDocument,
  createRuntime,
  createEventRuntime,
  resolveDocument,
  createDemoRequests,
  type ComponentNode,
  type LinguiDocument,
} from '@lingui/renderer'
function example(name: string): LinguiDocument {
  const { document } = JSON.parse(
    readFileSync(`../src/main/resources/skills/lingui-create/examples/${name}.json`, 'utf8'),
  )
  const { nodes, ...rest } = document
  return validateDocument({ ...rest, source: serializeSource(nodes as ComponentNode[]) })
}
describe('bundled Skill examples', () => {
  it.each(['api-retry', 'quiz', 'metrics', 'host-callback', 'motion'])(
    'validates %s against the actual renderer contract',
    (name) => expect(resolveDocument(example(name)).nodes.root).toBeDefined(),
  )
  it('demonstrates an HTTP failure followed by a successful retry', async () => {
    const document = example('api-retry'),
      runtime = createRuntime(document.state)
    const events = createEventRuntime(runtime, {
      requests: createDemoRequests({ latencyMs: 0 }),
      apis: Object.fromEntries(document.integrations!.apis.map((api) => [api.name, api])),
    })
    const node = resolveDocument(document).nodes.refresh!
    await events.fire(node, 'click')
    expect(runtime.state.error).toContain('503')
    await events.fire(node, 'click')
    expect(runtime.state.error).toBe('')
    expect(runtime.state.response).toMatchObject({ items: [{ id: 'api' }] })
    events.destroy()
  })
  it('resets quiz selections through the same event runtime', async () => {
    const document = example('quiz'),
      state = createRuntime(document.state),
      events = createEventRuntime(state)
    state.set({ path: '/answer' }, ['heap'])
    await events.fire(resolveDocument(document).nodes.reset!, 'click')
    expect(state.state.answer).toEqual([])
    events.destroy()
  })
  it('reads host summary snapshots without an API request or hardcoded article content', async () => {
    const document = example('host-callback')
    expect(document.integrations!.apis).toEqual([])
    expect(document.state.summary).toMatchObject({ title: '', content: '', gptName: '', postId: '' })
    const state = createRuntime(document.state)
    const snapshots = [
      { title: '文章页测试标题', gptName: '宿主 AI', content: '测试回调返回的内容', postId: 'test-post', loading: false, error: '' },
      { title: '', gptName: '', content: '', postId: 'test-post', loading: true, error: '' },
      { title: '', gptName: '', content: '', postId: 'test-post', loading: false, error: '宿主数据暂不可用' },
    ]
    for (const snapshot of snapshots) {
      let calls = 0
      const events = createEventRuntime(state, {
        inheritRegistered: false,
        requests: { allow: () => { throw new Error('Unexpected network request') } },
        callbacks: { 'zhiyue.summary': () => { calls++; return snapshot } },
      })
      await events.fire(resolveDocument(document).nodes.root!, 'mount')
      expect(state.state.summary).toEqual(snapshot)
      expect(calls).toBe(1)
      events.destroy()
    }
  })
})
