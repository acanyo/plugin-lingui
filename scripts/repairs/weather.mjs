import {
  resolveDocument,
  serializeSource,
  validateDocument,
} from '../../packages/renderer/dist/lingui-renderer.js'

/** Explicit repair of the locally tested weather work; never runs while loading a project. */
export function repairWeather(input) {
  const document = validateDocument(input)
  const { nodes } = resolveDocument(document)
  for (const id of [
    'root',
    'resultWrap',
    'obsRow',
    'mTemp',
    'mWind',
    'mDir',
    'mWeather',
    'mCode',
    'dayStatus',
  ])
    if (!nodes[id]) throw new Error(`天气作品缺少 ${id}，请手动检查后修复`)
  const path = (field) => ({ path: `/response/current_weather/${field}` })
  const present = (field) => ({ op: 'neq', args: [path(field), null] })
  const dynamic = (expression) => ({ call: 'lingui.evaluate', args: { expression } })
  const fallback = (field, value) => dynamic({ op: 'if', args: [present(field), value, '—'] })
  const hasWeather = {
    op: 'or',
    args: ['temperature', 'windspeed', 'winddirection', 'weathercode'].map(present),
  }
  const completed = [
    { path: '/loaded' },
    { op: 'not', args: [{ path: '/loading' }] },
    { op: 'eq', args: [{ path: '/error' }, ''] },
  ]
  nodes.resultWrap.condition = { op: 'and', args: [...completed, hasWeather] }
  nodes.root.children = nodes.root.children.filter((id) => id !== 'emptyWrap')
  nodes.root.children.splice(nodes.root.children.indexOf('resultWrap'), 0, 'emptyWrap')
  nodes.emptyWrap = {
    id: 'emptyWrap',
    component: 'LingUI.Conditional',
    child: 'emptyWeather',
    condition: { op: 'and', args: [...completed, { op: 'not', args: [hasWeather] }] },
  }
  nodes.emptyWeather = {
    id: 'emptyWeather',
    component: 'LingUI.EmptyState',
    title: '暂无天气数据',
    description: '接口已响应，但没有返回当前天气信息。请点击上方「获取实时天气」重试。',
  }
  for (const [id, field] of [
    ['mTemp', 'temperature'],
    ['mWind', 'windspeed'],
    ['mDir', 'winddirection'],
    ['mCode', 'weathercode'],
  ])
    nodes[id].value = fallback(field, path(field))
  nodes.obsValue.text = dynamic({
    op: 'if',
    args: [
      { op: 'and', args: [present('time'), { op: 'neq', args: [path('time'), ''] }] },
      path('time'),
      '观测时间未知',
    ],
  })
  const direction = nodes.mDir.description?.args?.expression
  if (!direction) throw new Error('天气作品风向计算已变化，请手动检查')
  nodes.mDir.description = dynamic({
    op: 'if',
    args: [present('winddirection'), direction, '风向信息缺失'],
  })
  const weather = nodes.mWeather.value?.args?.expression
  if (!weather) throw new Error('天气作品天气计算已变化，请手动检查')
  nodes.mWeather.value = fallback('weathercode', weather)
  nodes.obsRow.children = nodes.obsRow.children.map((id) =>
    id === 'dayStatus' ? 'dayStatusWrap' : id,
  )
  nodes.dayStatusWrap = {
    id: 'dayStatusWrap',
    component: 'LingUI.Conditional',
    child: 'dayStatus',
    condition: {
      op: 'or',
      args: [0, 1].map((value) => ({ op: 'eq', args: [path('is_day'), value] })),
    },
  }
  document.source = serializeSource(Object.values(nodes))
  const api = document.integrations?.apis.find((api) => api.name === 'loadWeather')
  if (!api) throw new Error('天气作品缺少 loadWeather 配置')
  api.responseExample = {
    current_weather: {
      temperature: 16.6,
      windspeed: 4.4,
      winddirection: 35,
      weathercode: 3,
      time: '2026-10-16T09:30',
      is_day: 1,
    },
  }
  return validateDocument(document)
}
