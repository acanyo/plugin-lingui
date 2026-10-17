import { softCard, column, document, section } from './builders'
export function codeGuideExample() {
  return document('Fetch 请求速查', [
    column('root', ['intro', 'reference']),
    section(
      'intro',
      '一次可靠的 Fetch 请求',
      '检查 HTTP 状态、解析响应，并在等待过久时取消请求。复制示例后，替换成你的接口地址。',
      ['code'],
      'JAVASCRIPT · 代码速查',
    ),
    {
      id: 'code',
      component: 'LingUI.CodeBlock',
      label: 'request.ts',
      language: 'typescript',
      code: 'async function loadArticles() {\n  const response = await fetch("/api/articles", {\n    signal: AbortSignal.timeout(8000),\n    headers: { Accept: "application/json" },\n  });\n\n  if (!response.ok) {\n    throw new Error(`HTTP ${response.status}`);\n  }\n\n  return response.json();\n}',
    },
    section('reference', '为什么要这样写', '请求成功到达服务器，并不意味着业务响应一定成功。', [
      'reference-card',
    ]),
    softCard('reference-card', 'keys'),
    {
      id: 'keys',
      component: 'LingUI.KeyValue',
      entries: [
        {
          label: 'response.ok',
          value: '检查状态码是否在 200–299 之间；fetch 不会因 404 自动拒绝。',
        },
        {
          label: 'timeout',
          value: '8 秒后取消等待。旧浏览器需要检查 AbortSignal.timeout 的兼容性。',
        },
        { label: 'json()', value: '异步读取并解析响应。解析失败也需要由调用方处理。' },
      ],
    },
  ])
}
