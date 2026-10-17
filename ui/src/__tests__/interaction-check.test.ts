import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  createInstance,
  serializeSource,
  parseSource,
  type ComponentNode,
  type JsonValue,
} from '@lingui/renderer'
import { column, document, text } from '../../../packages/renderer/src/examples/builders'
import { runInteractionCheck } from '../interaction-check/run'
import { repairInstruction } from '../interaction-check/repair'
import { defaultScenario, apiTargets } from '../integrations/scenarios/model'
function work(nodes: ComponentNode[], state: Record<string, JsonValue> = {}) {
  return createInstance(
    document(
      '交互自检',
      [
        column(
          'root',
          nodes.map((node) => node.id),
        ),
        ...nodes,
      ],
      state,
    ),
  )
}
function apiWork() {
  const instance = work(
    [
      {
        id: 'load',
        component: 'Button',
        child: 'label',
        events: {
          click: {
            loadingPath: '/loading',
            errorPath: '/error',
            actions: [{ type: 'api', name: 'data', resultPath: '/response' }],
          },
        },
      },
      text('label', '加载'),
      {
        id: 'list',
        component: 'LingUI.KeyValue',
        entries: [],
        bindings: { entries: { path: '/response/items' } },
      },
    ],
    { loading: false, error: '', response: null },
  )
  instance.document.integrations = {
    apis: [
      {
        name: 'data',
        label: '数据',
        url: 'https://example.com/data',
        method: 'GET',
        responseExample: { items: [{ label: '温度', value: '21°C' }] },
      },
    ],
    callbacks: [],
  }
  return instance
}
describe('isolated interaction self-check', () => {
  it('rejects a request whose inverted loading guard makes it impossible to start, without forcing the click', async () => {
    const instance = apiWork()
    const nodes = parseSource(instance.document.source)
    nodes.find((node) => node.id === 'load')!.disabled = {
      call: 'lingui.evaluate',
      args: { expression: { op: 'not', args: [{ path: '/loading' }] } },
    }
    instance.document.source = serializeSource(nodes)
    const result = await runInteractionCheck(instance)
    expect(
      result.cases.filter((row) => row.nodeId === 'load').every((row) => row.status === 'failed'),
    ).toBe(true)
    expect(result.issues.some((issue) => issue.message.includes('用户无法发起请求'))).toBe(true)
    expect(result.cases.every((row) => !row.changedPaths.length)).toBe(true)
    nodes.find((node) => node.id === 'load')!.disabled = { path: '/loading' }
    instance.document.source = serializeSource(nodes)
    const repaired = await runInteractionCheck(instance)
    expect(repaired.cases.find((row) => row.scenario === 'success')?.status).toBe('passed')
    expect(repaired.issues.some((issue) => issue.message.includes('用户无法发起请求'))).toBe(false)
  })
  it.each(['quiz', 'metrics', 'api-retry'])(
    'checks the real Skill %s sample with no external I/O',
    async (name) => {
      const { document } = JSON.parse(
        readFileSync(`../src/main/resources/skills/lingui-create/examples/${name}.json`, 'utf8'),
      )
      const { nodes, ...rest } = document
      const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('网络不应被调用'))
      try {
        const result = await runInteractionCheck(
          createInstance({ ...rest, source: serializeSource(nodes) }),
        )
        expect(result.issues.filter((issue) => issue.level === 'error')).toEqual([])
        expect(fetch).not.toHaveBeenCalled()
        expect(result.cases.length).toBeGreaterThanOrEqual(1)
      } finally {
        fetch.mockRestore()
      }
    },
  )
  it('detects expressions that fail only after changing a valid numeric input', async () => {
    const instance = work(
      [
        {
          id: 'divisor',
          component: 'LingUI.NumberInput',
          label: '除数',
          value: { path: '/divisor' },
          min: 0,
          max: 10,
        },
        {
          id: 'result',
          component: 'Text',
          text: {
            call: 'lingui.evaluate',
            args: { expression: { op: 'divide', args: [10, { path: '/divisor' }] } },
          },
        },
      ],
      { divisor: 2 },
    )
    const before = JSON.stringify(instance)
    const result = await runInteractionCheck(instance)
    expect(result.cases.find((row) => row.nodeId === 'divisor' && row.input === 0)?.status).toBe(
      'failed',
    )
    expect(result.issues).toContainEqual({
      nodeId: 'result',
      level: 'error',
      message: '除数不能为零',
    })
    expect(result.cases.find((row) => row.nodeId === 'divisor' && row.input === 10)?.status).toBe(
      'passed',
    )
    expect(JSON.stringify(instance)).toBe(before)
    expect(repairInstruction(result)).toContain('divisor / change')
  })
  it('runs success, empty and failure branches and reports invalid collection data', async () => {
    const instance = apiWork(),
      target = apiTargets(instance.document)[0]!
    const result = await runInteractionCheck(instance)
    expect(
      result.cases.filter((row) => row.nodeId === 'load').map((row) => [row.scenario, row.status]),
    ).toEqual([
      ['success', 'passed'],
      ['empty', 'passed'],
      ['missing', 'passed'],
      ['partial', 'failed'],
      ['null', 'passed'],
      ['failure', 'passed'],
      ['recovery', 'passed'],
    ])
    expect(result.cases.find((row) => row.scenario === 'success')?.changedPaths).toContain(
      '/response',
    )
    const invalid = await runInteractionCheck(instance, {
      rules: {
        [target.key]: { ...defaultScenario(target), success: { items: [{ wrong: 'field' }] } },
      },
    })
    expect(invalid.cases.find((row) => row.scenario === 'success')?.status).toBe('failed')
    expect(invalid.issues.some((issue) => issue.nodeId === 'list' && issue.level === 'error')).toBe(
      true,
    )
  })
  it('distinguishes expected HTTP failure from a broken error recovery action', async () => {
    const instance = apiWork()
    const nodes = JSON.parse(
      readFileSync('../src/main/resources/skills/lingui-create/examples/api-retry.json', 'utf8'),
    ).document.nodes as ComponentNode[]
    const load = nodes.find((node) => node.events)!
    load.events!.click!.onError = [
      { type: 'local', actions: [{ type: 'increment', path: '/error' }] },
    ]
    instance.document.source = serializeSource(nodes)
    instance.document.state = { response: null, loading: false, error: '' }
    instance.document.integrations = {
      apis: [
        {
          name: 'checkHealth',
          label: '状态',
          url: '/health',
          method: 'GET',
          responseExample: { items: [] },
        },
      ],
      callbacks: [],
    }
    const result = await runInteractionCheck(instance)
    expect(result.cases.find((row) => row.scenario === 'failure')?.status).toBe('failed')
    expect(result.issues.some((issue) => issue.message.includes('步进需要数字'))).toBe(true)
  })
  it('checks retry success on the same state and rejects a stale error left after recovery', async () => {
    const instance = apiWork()
    const nodes = (await import('@lingui/renderer')).parseSource(instance.document.source)
    nodes.find((node) => node.id === 'load')!.events!.click!.onSuccess = [
      { type: 'local', actions: [{ type: 'setState', path: '/error', value: '旧错误' }] },
    ]
    instance.document.source = serializeSource(nodes)
    const result = await runInteractionCheck(instance)
    const recovery = result.cases.find((row) => row.scenario === 'recovery')!
    expect(recovery.status).toBe('failed')
    expect(recovery.issues.some((issue) => issue.message.includes('仍保留旧错误'))).toBe(true)
  })
  it('marks missing response fixtures and host callbacks as unverified instead of inventing passing data', async () => {
    const instance = apiWork()
    delete instance.document.integrations!.apis[0]!.responseExample
    const result = await runInteractionCheck(instance)
    expect(result.cases.find((row) => row.scenario === 'success')?.status).toBe('skipped')
    expect(result.cases.find((row) => row.scenario === 'failure')?.status).toBe('passed')
    const callback = work([
      {
        id: 'call',
        component: 'Button',
        child: 'label',
        events: { click: { actions: [{ type: 'callback', name: 'external' }] } },
      },
      text('label', '回调'),
    ])
    callback.document.integrations = {
      apis: [],
      callbacks: [{ name: 'external', label: '宿主回调' }],
    }
    expect((await runInteractionCheck(callback)).cases.at(-1)?.status).toBe('skipped')
  })
  it('honors cancellation, limits and redacts diagnostics sent back to AI', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      runInteractionCheck(apiWork(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    const report = await runInteractionCheck(apiWork(), { maxCases: 1 })
    expect(report.limited).toBe(true)
    report.cases[0]!.status = 'failed'
    report.cases[0]!.issues.push({
      nodeId: 'x',
      level: 'error',
      message: 'https://example.com/?token=private lgu_mcp_secret',
    })
    expect(repairInstruction(report)).not.toContain('private')
    expect(repairInstruction(report)).not.toContain('lgu_mcp_secret')
  })
  it('leaves selection payloads to real component events instead of fabricating broken data', async () => {
    const instance = work(
      [
        {
          id: 'menu',
          component: 'LingUI.Dropdown',
          label: '操作',
          menuItems: [{ id: 'refresh', label: '刷新' }],
          events: {
            select: {
              actions: [
                {
                  type: 'local',
                  actions: [{ type: 'setState', path: '/selected', value: { $event: '/id' } }],
                },
              ],
            },
          },
        },
      ],
      { selected: '' },
    )
    const result = await runInteractionCheck(instance)
    expect(result.cases.find((row) => row.nodeId === 'menu')?.status).toBe('skipped')
    expect(result.issues.some((issue) => issue.message.includes('特定载荷'))).toBe(true)
  })
  it('does not evaluate unrelated hidden values while preparing a button event payload', async () => {
    const nodes: ComponentNode[] = [
      column('root', ['run', 'hidden']),
      {
        id: 'run',
        component: 'Button',
        child: 'label',
        events: {
          click: {
            actions: [
              { type: 'local', actions: [{ type: 'setState', path: '/done', value: true }] },
            ],
          },
        },
      },
      text('label', '运行'),
      { id: 'hidden', component: 'LingUI.Conditional', condition: false, child: 'metric' },
      {
        id: 'metric',
        component: 'LingUI.Metric',
        label: '隐藏指标',
        value: {
          call: 'lingui.evaluate',
          args: { expression: { op: 'divide', args: [1, { path: '/absent' }] } },
        },
      },
    ]
    const instance = createInstance(document('隐藏指标', nodes, { done: false }))
    const report = await runInteractionCheck(instance)
    expect(report.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(report.cases).toHaveLength(2)
    expect(report.cases.find((row) => row.nodeId === 'run')?.status).toBe('passed')
  })
})
