import { section, grid, softCard, column, document, text } from './builders'

export function summaryExample() {
  const points = [
    ['内容先行', '先回答读者的问题，再选择合适的表达方式。'],
    ['适量互动', '把测验、对比或计算放在真正需要的地方。'],
    ['保持可读', '让每个组件离开交互之后，仍然能传达主要信息。'],
  ]
  return document('文章摘要', [
    section(
      'root',
      '关于互动文章，你需要知道的',
      '三个要点，帮助你把文章写得更清楚。',
      ['points'],
      '30 秒了解本文',
    ),
    grid(
      'points',
      points.map((_, i) => `point${i}`),
      3,
    ),
    ...points.flatMap(([title, body], i) => [
      softCard(`point${i}`, `point-content${i}`),
      column(`point-content${i}`, [`icon${i}`, `copy${i}`]),
      { id: `icon${i}`, component: 'Icon' as const, name: 'check' },
      column(`copy${i}`, [`heading${i}`, `body${i}`]),
      text(`heading${i}`, title!, 'h3'),
      text(`body${i}`, body!),
    ]),
  ])
}
