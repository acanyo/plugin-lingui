import { section, softCard, column, document, text } from './builders'

export function stepsExample() {
  const steps = [
    [
      '明确读者的问题',
      '写下读者想解决的一个具体问题，删掉与它无关的内容。',
      '例如：如何给一篇长文章增加互动？',
    ],
    [
      '用合适的结构表达',
      '把结论放在前面，再用例子解释。需要比较时用表格，需要操作时用步骤。',
      '先把内容写清楚，再决定用什么组件。',
    ],
    [
      '预览并分享',
      '分别检查桌面和手机宽度，自己完成一次交互，再发布文章。',
      '好的文章，让读者知道下一步能做什么。',
    ],
  ]
  return document(
    '分步教程',
    [
      section(
        'root',
        '完成你的第一篇互动文章',
        '从明确问题到预览发布，按自己的节奏完成三个步骤。',
        ['steps'],
        '写作指南',
      ),
      {
        id: 'steps',
        component: 'LingUI.Steps',
        value: { path: '/step' },
        children: steps.map((_, i) => `step${i}`),
      },
      ...steps.flatMap(([title, body, hint], i) => [
        softCard(`step${i}`, `step-content${i}`),
        column(`step-content${i}`, [`title${i}`, `body${i}`, `hint${i}`]),
        text(`title${i}`, title!, 'h3'),
        text(`body${i}`, body!),
        text(`hint${i}`, hint!, 'caption'),
      ]),
    ],
    { step: 0 },
  )
}
