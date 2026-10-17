import {
  section,
  softCard,
  grid,
  button,
  column,
  computed,
  document,
  metric,
  text,
} from './builders'

export function budgetExample() {
  return document(
    '出行预算',
    [
      section(
        'root',
        '给下一次出行留好预算',
        '调整每日开销、交通和天数，预算会实时更新。',
        ['content'],
        '行前规划',
      ),
      column('content', ['input-card', 'result-card', 'reset']),
      softCard('input-card', 'controls'),
      column('controls', ['inputs', 'days']),
      softCard('result-card', 'results'),
      column('results', ['total', 'hint']),
      grid('inputs', ['daily', 'transport']),
      {
        id: 'daily',
        component: 'LingUI.NumberInput',
        label: '每日食宿（元）',
        value: { path: '/daily' },
        min: 0,
        max: 100000,
        step: 50,
      },
      {
        id: 'transport',
        component: 'LingUI.NumberInput',
        label: '往返交通（元）',
        value: { path: '/transport' },
        min: 0,
        max: 100000,
        step: 100,
      },
      {
        id: 'days',
        component: 'Slider',
        label: '出行天数',
        value: { path: '/days' },
        min: 1,
        max: 30,
        step: 1,
      },
      metric(
        'total',
        '预计总花费 · 元',
        computed({
          op: 'add',
          args: [
            { op: 'multiply', args: [{ path: '/daily' }, { path: '/days' }] },
            { path: '/transport' },
          ],
        }),
        '每日食宿 × 天数 + 往返交通',
      ),
      text('hint', '不含购物、门票及临时支出，建议另留一些余量。', 'caption'),
      button('reset', 'resetLabel', [{ type: 'reset' }], 'text'),
      text('resetLabel', '恢复默认预算'),
    ],
    { daily: 350, transport: 600, days: 3 },
  )
}
