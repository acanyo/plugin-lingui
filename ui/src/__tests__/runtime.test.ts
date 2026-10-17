import { describe, expect, it } from 'vitest'
import {
  createRuntime,
  evaluate,
  parameterState,
  createInstance,
  examples,
  writePath,
  readPath,
  type Action,
} from '@lingui/renderer'
const action = (actions: Action['functionCall']['args']['actions']): Action => ({
  functionCall: { call: 'lingui.dispatch', args: { actions } },
})
describe('local interaction runtime', () => {
  it('isolates surfaces and resets their own snapshots', () => {
    const first = createRuntime({ open: false, count: 0 }),
      second = createRuntime({ open: false })
    first.dispatch(
      action([
        { type: 'toggleState', path: '/open' },
        { type: 'increment', path: '/count', value: 3 },
      ]),
    )
    expect(first.state).toEqual({ open: true, count: 3 })
    expect(second.state.open).toBe(false)
    first.reset()
    expect(first.state).toEqual({ open: false, count: 0 })
  })
  it('rolls back an invalid action batch', () => {
    const runtime = createRuntime({ count: 0 })
    expect(() =>
      runtime.dispatch(
        action([
          { type: 'increment', path: '/count' },
          { type: 'toggleState', path: '/count' },
        ]),
      ),
    ).toThrow()
    expect(runtime.state.count).toBe(0)
  })
  it('evaluates calculations, conditions and quiz selections', () => {
    expect(
      evaluate(
        { op: 'round', args: [{ op: 'divide', args: [{ path: '/words' }, { path: '/speed' }] }] },
        { words: 2400, speed: 300 },
      ),
    ).toBe(8)
    expect(
      evaluate(
        {
          op: 'if',
          args: [{ op: 'includes', args: [{ path: '/answer' }, 'heap'] }, '正确', '错误'],
        },
        { answer: ['heap'] },
      ),
    ).toBe('正确')
  })
  it('rejects division by zero, unsupported operators, malformed arity and nonfinite results', () => {
    for (const expression of [
      { op: 'divide', args: [1, 0] },
      { op: 'execute', args: ['alert()'] },
      { op: 'subtract', args: [1] },
      { op: 'multiply', args: [1e300, 1e300] },
    ])
      expect(() => evaluate(expression, {})).toThrow()
  })
  it('evaluates only the selected branch', () => {
    expect(evaluate({ op: 'if', args: [false, { op: 'divide', args: [1, 0] }, 10] }, {})).toBe(10)
  })
  it('uses scoped RFC6901 paths and validates array indices', () => {
    const state = { 'a/b': { '~key': 3 }, items: ['one'] }
    expect(readPath(state, '/a~1b/~0key')).toBe(3)
    writePath(state, '/items/0', 'two')
    expect(state.items).toEqual(['two'])
    expect(() => writePath(state, '/items/999999', 'bad')).toThrow()
    expect(() => readPath(state, '/a~2b')).toThrow()
  })
  it('validates parameter bounds and type before rendering', () => {
    const instance = createInstance(examples[3]!.create())
    instance.parameters.words = 900
    expect(parameterState(instance).words).toBe(900)
    instance.parameters.words = -1
    expect(() => parameterState(instance)).toThrow('范围')
  })
  it('notifies subscribers after successful commits only', () => {
    const runtime = createRuntime({ count: 0 })
    const states: number[] = []
    const unsubscribe = runtime.subscribe((state) => states.push(Number(state.count)))
    runtime.dispatch(action([{ type: 'increment', path: '/count' }]))
    unsubscribe()
    runtime.reset()
    expect(states).toEqual([0, 1])
  })
})
