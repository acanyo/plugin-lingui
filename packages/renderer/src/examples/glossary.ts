import { section, softCard, column, document, text } from './builders'

export function glossaryExample() {
  const terms = [
    [
      'API',
      '应用程序接口',
      '约定好输入和输出，让不同程序可以互相协作。',
      '像餐厅菜单：你按约定点单，厨房按约定出餐。',
    ],
    [
      '缓存',
      '把常用结果保存在近处',
      '减少重复计算或网络请求，以更快的速度返回相同的结果。',
      '像手边的笔记本：查过的资料不必每次都重新翻书。',
    ],
    [
      '异步',
      '等待时继续做其他事',
      '任务发出后不阻塞当前流程，结果就绪时再进行处理。',
      '像取餐叫号：下单后可以先去找座位。',
    ],
  ]
  return document(
    '术语解释',
    [
      section(
        'root',
        '把技术概念说简单',
        '切换术语，先理解含义，再看一个日常例子。',
        ['tabs'],
        '技术词典',
      ),
      {
        id: 'tabs',
        component: 'LingUI.Tabs',
        value: { path: '/tab' },
        tabs: terms.map(([title], i) => ({ title: title!, child: `term${i}` })),
      },
      ...terms.flatMap(([, title, body, example], i) => [
        softCard(`term${i}`, `term-content${i}`),
        column(`term-content${i}`, [`title${i}`, `body${i}`, `example${i}`]),
        text(`title${i}`, title!, 'h3'),
        text(`body${i}`, body!),
        text(`example${i}`, example!, 'caption'),
      ]),
    ],
    { tab: 0 },
  )
}
