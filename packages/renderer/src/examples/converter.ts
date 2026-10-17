import { section, softCard, column, computed, document, metric, text } from './builders'

export function converterExample() {
  return document(
    '温度换算',
    [
      section(
        'root',
        '摄氏度与华氏度',
        '输入数字或拖动滑块，实时查看换算结果。',
        ['content'],
        '温度换算',
      ),
      column('content', ['controls', 'result-card']),
      column('controls', ['input', 'slider']),
      softCard('result-card', 'result-content'),
      column('result-content', ['result', 'formula']),
      {
        id: 'input',
        component: 'LingUI.NumberInput',
        label: '摄氏度（°C）',
        value: { path: '/celsius' },
        min: -50,
        max: 100,
        step: 1,
      },
      {
        id: 'slider',
        component: 'Slider',
        label: '拖动调整摄氏度',
        value: { path: '/celsius' },
        min: -50,
        max: 100,
        step: 1,
      },
      metric(
        'result',
        '华氏度 · °F',
        computed({
          op: 'divide',
          args: [
            {
              op: 'round',
              args: [
                {
                  op: 'multiply',
                  args: [
                    {
                      op: 'add',
                      args: [{ op: 'multiply', args: [{ path: '/celsius' }, 1.8] }, 32],
                    },
                    10,
                  ],
                },
              ],
            },
            10,
          ],
        }),
      ),
      text('formula', '换算公式：°F = °C × 1.8 + 32', 'caption'),
    ],
    { celsius: 25 },
  )
}
