import { card, column, text } from '../builders'
import { apiButton, apiDocument, apiEvent, apiExamplePrefix } from './builders'

export function apiSearchExample() {
  const search = apiEvent('searchArticles', { q: { $state: '/query' } })
  return apiDocument(
    '文章搜索与详情',
    '输入关键词后查询，选择结果查看详情。试试「Flux」，或输入不存在的词查看空状态。',
    ['query', 'load', 'results', 'detail-card'],
    [
      {
        id: 'query',
        component: 'LingUI.SearchInput',
        label: '搜索文章',
        placeholder: '例如 Flux、JVM、组件',
        value: { path: '/query' },
        events: { search },
      },
      ...apiButton('load', '查询文章', search),
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
          emptyText: '点击查询，或调整关键词后重试',
        },
        events: {
          retry: search,
          select: {
            actions: [
              {
                type: 'local',
                actions: [{ type: 'setState', path: '/selected', value: { $event: '/item' } }],
              },
            ],
          },
        },
      },
      card('detail-card', 'detail'),
      column('detail', ['detail-title', 'detail-summary']),
      text('detail-title', { path: '/selected/label' }, 'h3'),
      text('detail-summary', { path: '/selected/description' }),
    ],
    [
      {
        name: 'searchArticles',
        label: '搜索文章',
        method: 'GET',
        url: `${apiExamplePrefix}articles`,
        description: 'q 为搜索关键词；返回 items。将此地址替换为你的文章查询接口。',
        inputExample: { q: 'Flux' },
        responseExample: {
          items: [
            { id: 'article-1', name: 'Spring Flux 入门', summary: '用背压连接生产者与消费者。' },
          ],
        },
      },
    ],
    {
      query: '',
      selected: { label: '文章详情', description: '查询后选择一条结果，在这里查看摘要。' },
    },
  )
}
