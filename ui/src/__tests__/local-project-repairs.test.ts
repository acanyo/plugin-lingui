import { afterEach, describe, expect, it } from 'vitest'
import {
  createInstance,
  validateDocument,
  mountRenderer,
  type JsonValue,
  type RendererHandle,
} from '@lingui/renderer'
import { repairWeather } from '../../../scripts/repairs/weather.mjs'
import { repairQuiz } from '../../../scripts/repairs/quiz.mjs'
import fixtures from './fixtures/local-project-repairs.json'
import { runInteractionCheck } from '../interaction-check/run'
import { apiTargets, defaultScenario } from '../integrations/scenarios/model'

const handles: RendererHandle[] = []
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.destroy())
  document.body.replaceChildren()
})
function weather(response: JsonValue) {
  const definition = repairWeather(fixtures['北京实时天气插件'])
  definition.state = { ...definition.state, loaded: true, response }
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(mountRenderer(host, createInstance(definition)))
  return host.shadowRoot!
}
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('explicit local project repairs', () => {
  const emptyResponses: JsonValue[] = [{}, null, { current_weather: null }, { current_weather: {} }]
  it.each(emptyResponses)(
    'shows an empty state for %j, without weather calculations or guessed night status',
    (response) => {
      const root = weather(response)
      expect(root.textContent).toContain('暂无天气数据')
      expect(root.textContent).toContain('获取实时天气')
      expect(
        [...root.querySelectorAll('h3')].some((heading) => heading.textContent === '当前天气'),
      ).toBe(false)
      expect(root.textContent).not.toContain('夜间')
      expect(root.textContent).not.toContain('计算暂不可用')
      expect(root.querySelector('[role=alert]')).toBeNull()
    },
  )
  it('retains zero temperature and wind speed while showing placeholders for absent fields', () => {
    const root = weather({ current_weather: { temperature: 0, windspeed: 0 } })
    expect(root.textContent).toContain('当前天气')
    expect(root.textContent).not.toContain('暂无天气数据')
    expect(root.textContent).not.toContain('夜间')
    expect(root.textContent).toContain('观测时间未知')
    expect(root.textContent).toContain('风向信息缺失')
    expect(root.textContent).toContain('—')
    expect(root.querySelector('[role=alert]')).toBeNull()
    expect(
      [...root.querySelectorAll('.lg-metric')].slice(0, 2).map((node) => node.textContent),
    ).toEqual(expect.arrayContaining([expect.stringContaining('0')]))
  })
  it('treats explicit zero codes and night status as valid data', () => {
    const root = weather({
      current_weather: {
        temperature: 0,
        windspeed: 0,
        winddirection: 0,
        weathercode: 0,
        is_day: 0,
        time: '2026-10-16T00:00',
      },
    })
    expect(root.textContent).toContain('晴朗')
    expect(root.textContent).toContain('夜间')
    expect(root.textContent).toContain('偏北风')
    expect(root.textContent).not.toContain('—')
    expect(root.querySelector('[role=alert]')).toBeNull()
  })
  it('passes isolated checks for successful, empty and failed weather responses without external I/O', async () => {
    const before = JSON.stringify(fixtures['北京实时天气插件'])
    const instance = createInstance(repairWeather(fixtures['北京实时天气插件']))
    const target = apiTargets(instance.document)[0]!
    const rule = { ...defaultScenario(target), empty: {} }
    const result = await runInteractionCheck(instance, { rules: { [target.key]: rule } })
    expect(result.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(result.cases.some((item) => item.scenario === 'empty')).toBe(true)
    expect(JSON.stringify(fixtures['北京实时天气插件'])).toBe(before)
  })
  it('repairs the saved legacy quiz without changing its original snapshot or layout', async () => {
    const before = JSON.stringify(fixtures['知识测验'])
    const host = document.createElement('div')
    document.body.append(host)
    handles.push(mountRenderer(host, createInstance(repairQuiz(fixtures['知识测验']))))
    const root = host.shadowRoot!
    const submit = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '提交答案',
    )!
    expect(submit.disabled).toBe(true)
    submit.click()
    await settle()
    expect(root.textContent).not.toContain('再想一想')
    const counter = root.querySelector<HTMLInputElement>('input[value=counter]')!
    counter.checked = true
    counter.dispatchEvent(new Event('change', { bubbles: true }))
    await settle()
    expect(submit.disabled).toBe(false)
    submit.click()
    await settle()
    expect(root.textContent).toContain('再想一想')
    ;[...root.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '重新作答')!
      .click()
    await settle()
    expect(submit.disabled).toBe(true)
    expect(counter.checked).toBe(false)
    expect(root.textContent).toContain('下面哪一个区域主要存储对象实例？')
    expect(JSON.stringify(fixtures['知识测验'])).toBe(before)
  })
  it('detects the old empty-answer submission and respects the repaired disabled control', async () => {
    const before = await runInteractionCheck(createInstance(validateDocument(fixtures['知识测验'])))
    expect(before.issues.some((issue) => issue.message.includes('未选择答案'))).toBe(true)
    const after = await runInteractionCheck(createInstance(repairQuiz(fixtures['知识测验'])))
    expect(after.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(
      after.cases.some(
        (row) =>
          row.status === 'skipped' &&
          row.issues.some((issue) => issue.message.includes('控件禁用')),
      ),
    ).toBe(true)
  })
})
