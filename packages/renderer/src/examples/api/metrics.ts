import { apiButton, apiDocument, apiEvent, apiExamplePrefix } from './builders'

export function apiMetricsExample() {
  const load = apiEvent('getReadingStats', { period: { $state: '/period' } })
  return apiDocument(
    '筛选联动图表',
    '打开时自动查询阅读数据，同一份响应同时驱动图表与表格。切换范围会重新查询，也可以手动刷新。',
    ['period', 'load', 'chart', 'table'],
    [
      {
        id: 'period',
        component: 'LingUI.Select',
        label: '统计范围',
        value: { path: '/period' },
        clearable: false,
        options: [
          { label: '最近 7 天', value: 'week' },
          { label: '最近 30 天', value: 'month' },
        ],
        events: { change: load },
      },
      ...apiButton('load', '刷新阅读数据', load),
      {
        id: 'chart',
        component: 'LingUI.BarChart',
        label: '文章阅读次数',
        unit: '次',
        data: [],
        bindings: { data: { path: '/response/items', map: { label: '/name', value: '/views' } } },
        dataState: {
          loading: { path: '/loading' },
          error: { path: '/error' },
          emptyText: '当前范围暂无阅读数据',
        },
        events: { retry: load },
      },
      {
        id: 'table',
        component: 'LingUI.Table',
        label: '阅读数据明细',
        columns: ['文章', '阅读次数'],
        rows: [],
        bindings: {
          rows: { path: '/response/items', map: { label: '/name', cells: ['/displayViews'] } },
        },
        dataState: {
          loading: { path: '/loading' },
          error: { path: '/error' },
          emptyText: '加载后显示阅读明细',
        },
        events: { retry: load },
      },
    ],
    [
      {
        name: 'getReadingStats',
        label: '查询阅读统计',
        method: 'GET',
        url: `${apiExamplePrefix}stats`,
        description: 'period 为 week 或 month；views 为图表数值，displayViews 为表格显示文字。',
        inputExample: { period: 'week' },
        responseExample: { items: [{ name: 'Spring Flux 入门', views: 128, displayViews: '128' }] },
      },
    ],
    { period: 'week' },
    load,
  )
}
