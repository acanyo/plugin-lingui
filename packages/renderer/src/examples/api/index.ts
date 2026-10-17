import { apiSearchExample } from './search'
import { apiPaginationExample } from './pagination'
import { apiSubmissionExample } from './submission'
import { apiMetricsExample } from './metrics'
import { apiRetryExample } from './retry'

export { apiExamplePrefix } from './builders'
export { createDemoRequests, isDemoApi } from './demo-requests'
export const apiExamples = [
  {
    id: 'api-search',
    title: '文章搜索与详情',
    category: '接口应用',
    icon: 'search',
    method: 'GET',
    description: '关键词查询、列表映射与选择详情。',
    features: ['查询参数', '空状态', '列表选择'],
    steps: [
      '点击查询，观察加载状态和文章列表。',
      '搜索 Flux，再选择一条结果查看详情。',
      '输入不存在的关键词，体验空状态。',
    ],
    create: apiSearchExample,
  },
  {
    id: 'api-pagination',
    title: '分页数据表格',
    category: '接口应用',
    icon: 'list',
    method: 'GET',
    description: '把页码传给接口，按页更新表格。',
    features: ['分页参数', '表格映射', '加载状态'],
    steps: [
      '加载当前页，每页显示 3 条文章。',
      '点击下一页，查看表格随页码更新。',
      '在接口配置中查看 page 和 pageSize。',
    ],
    create: apiPaginationExample,
  },
  {
    id: 'api-submission',
    title: '表单提交与回执',
    category: '接口应用',
    icon: 'code',
    method: 'POST',
    description: '校验必填内容，提交 JSON 并显示回执。',
    features: ['必填校验', 'JSON 提交', '结果回填'],
    steps: [
      '直接提交空表单，体验必填校验。',
      '填写至少 2 字称呼和 5 字建议后提交。',
      '查看模拟回执；输入不会被发送或保存。',
    ],
    create: apiSubmissionExample,
  },
  {
    id: 'api-metrics',
    title: '筛选联动图表',
    category: '接口应用',
    icon: 'chart',
    method: 'GET',
    description: '切换范围，一份响应联动图表和表格。',
    features: ['筛选联动', '图表绑定', '共享响应'],
    steps: [
      '加载最近 7 天的数据。',
      '切换到最近 30 天，观察图表和表格同步变化。',
      '查看数值字段与显示文字的映射方式。',
    ],
    create: apiMetricsExample,
  },
  {
    id: 'api-retry',
    title: '请求失败与重试',
    category: '接口应用',
    icon: 'warning',
    method: 'GET',
    description: '模拟服务异常，显示错误并重试恢复。',
    features: ['HTTP 错误', '失败提示', '重试恢复'],
    steps: [
      '读取服务状态，首次固定返回 HTTP 503。',
      '在错误提示中点击重试，等待服务恢复。',
      '点击重置案例，可重新体验整个过程。',
    ],
    create: apiRetryExample,
  },
]
