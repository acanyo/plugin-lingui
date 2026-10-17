import { apiButton, apiDocument, apiEvent, apiExamplePrefix } from './builders'

export function apiRetryExample() {
  const load = apiEvent('checkService')
  return apiDocument(
    '请求失败与重试',
    '首次请求会模拟 HTTP 503。查看具体错误后点击「重试」，第二次返回服务状态；重置案例可再次体验。',
    ['load', 'results'],
    [
      ...apiButton('load', '读取服务状态', load),
      {
        id: 'results',
        component: 'List',
        children: [],
        items: [],
        bindings: {
          items: {
            path: '/response/items',
            map: { id: '/id', label: '/name', description: '/summary' },
          },
        },
        dataState: {
          loading: { path: '/loading' },
          error: { path: '/error' },
          emptyText: '点击按钮，体验加载与失败重试',
        },
        events: { retry: load },
      },
    ],
    [
      {
        name: 'checkService',
        label: '查询服务状态',
        method: 'GET',
        url: `${apiExamplePrefix}health`,
        description: '案例首次返回 503，后续成功；用于学习 loadingPath、errorPath 和 retry 事件。',
        inputExample: {},
        responseExample: {
          items: [{ id: 'api', name: '业务接口可用', summary: '请求恢复正常，可以继续操作。' }],
        },
      },
    ],
  )
}
