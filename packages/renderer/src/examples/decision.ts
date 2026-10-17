import { section, softCard, column, computed, document, text } from './builders'

export function decisionExample() {
  return document(
    '阅读路线选择',
    [
      section(
        'root',
        '找到适合你的阅读路线',
        '选择现在的目标，查看适合你的下一步。',
        ['content'],
        '阅读导航',
      ),
      column('content', ['choices', 'result-card']),
      softCard('result-card', 'result-content'),
      column('result-content', ['resultTitle', 'result']),
      {
        id: 'choices',
        component: 'ChoicePicker',
        label: '你现在更想了解什么？',
        value: { path: '/route' },
        variant: 'mutuallyExclusive',
        options: [
          { label: '先弄明白概念', value: 'basics' },
          { label: '动手做一个例子', value: 'practice' },
          { label: '深入原理与取舍', value: 'deep' },
        ],
      },
      text('resultTitle', '你的建议路线', 'h3'),
      text(
        'result',
        computed({
          op: 'if',
          args: [
            { op: 'includes', args: [{ path: '/route' }, 'basics'] },
            '先读术语解释，再看架构图，最后用知识闪卡巩固概念。',
            {
              op: 'if',
              args: [
                { op: 'includes', args: [{ path: '/route' }, 'practice'] },
                '从分步教程开始，边做边检查，完成后再回顾背后的原理。',
                '先比较不同方案的取舍，再结合架构图阅读实现细节。',
              ],
            },
          ],
        }),
      ),
    ],
    { route: ['basics'] },
  )
}
