import { apiButton, apiDocument, apiEvent, apiExamplePrefix } from './builders'

export function apiPaginationExample() {
  const load = apiEvent('listArticles', { page: { $state: '/page' }, pageSize: 3 })
  return apiDocument(
    '分页数据表格',
    '每页读取 3 条文章，翻页时发送新的查询。示例共 9 条；接入真实接口时请同步调整分页总数。',
    ['load', 'table', 'pages'],
    [
      ...apiButton('load', '加载当前页', load),
      {
        id: 'table',
        component: 'LingUI.Table',
        label: '文章列表',
        columns: ['文章', '分类', '状态'],
        rows: [],
        bindings: {
          rows: {
            path: '/response/items',
            map: { label: '/name', cells: ['/category', '/status'] },
          },
        },
        dataState: {
          loading: { path: '/loading' },
          error: { path: '/error' },
          emptyText: '加载后显示这一页的数据',
        },
        events: { retry: load },
      },
      {
        id: 'pages',
        component: 'LingUI.Pagination',
        label: '文章分页',
        totalPages: 3,
        value: { path: '/page' },
        disabled: { path: '/loading' },
        events: { change: load },
      },
    ],
    [
      {
        name: 'listArticles',
        label: '分页查询文章',
        method: 'GET',
        url: `${apiExamplePrefix}articles`,
        description: 'page 从 1 开始；pageSize 为每页数量。items 绑定到表格行。',
        inputExample: { page: 1, pageSize: 3 },
        responseExample: {
          items: [
            { id: 'article-1', name: 'Spring Flux 入门', category: '后端开发', status: '已发布' },
          ],
          total: 9,
          page: 1,
        },
      },
    ],
    { page: 1 },
  )
}
