import { section, softCard, grid, button, column, document, text } from './builders'
export function calculatorExample() {
  const value = document(
    '参数计算器',
    [
      section(
        'root',
        '阅读时间计算器',
        '根据文章字数和阅读速度，估算完成阅读需要的时间。',
        ['content'],
        '阅读工具',
      ),
      column('content', ['controls-card', 'result-card', 'reset']),
      softCard('controls-card', 'controls'),
      column('controls', ['inputs', 'slider']),
      grid('inputs', ['words', 'speed']),
      softCard('result-card', 'result-content'),
      column('result-content', ['resultLabel', 'result', 'hint']),
      {
        id: 'words',
        component: 'LingUI.NumberInput',
        label: '文章字数',
        value: { path: '/words' },
        min: 0,
        max: 100000,
        step: 100,
      },
      {
        id: 'speed',
        component: 'LingUI.NumberInput',
        label: '每分钟阅读字数',
        value: { path: '/speed' },
        min: 100,
        max: 1000,
        step: 10,
      },
      {
        id: 'slider',
        component: 'Slider',
        label: '调整阅读速度',
        value: { path: '/speed' },
        min: 100,
        max: 1000,
        step: 10,
      },
      text('resultLabel', '预计阅读时间（分钟）', 'caption'),
      text(
        'result',
        {
          call: 'lingui.evaluate',
          args: {
            expression: {
              op: 'max',
              args: [
                1,
                {
                  op: 'round',
                  args: [{ op: 'divide', args: [{ path: '/words' }, { path: '/speed' }] }],
                },
              ],
            },
          },
        },
        'h1',
      ),
      text('hint', '计算在浏览器内完成，参数不会上传。', 'caption'),
      button('reset', 'resetLabel', [{ type: 'reset' }]),
      text('resetLabel', '恢复默认参数'),
    ],
    { words: 2400, speed: 300 },
  )
  value.parameters = [
    {
      key: 'words',
      label: '初始文章字数',
      path: '/words',
      type: 'number',
      default: 2400,
      min: 0,
      max: 100000,
    },
  ]
  return value
}
