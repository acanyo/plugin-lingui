import { grid, softCard, column, document, metric, section } from './builders'
export function benchmarkExample() {
  return document('性能实验记录', [
    column('root', ['intro', 'results']),
    section(
      'intro',
      '让优化效果有据可查',
      '用同一批请求比较优化前后的表现。以下为演示数据，用于展示记录方式。',
      ['metrics'],
      '性能观察 · 示例数据',
    ),
    grid('metrics', ['before-card', 'after-card', 'reduction-card'], 3),
    softCard('before-card', 'before'),
    softCard('after-card', 'after'),
    softCard('reduction-card', 'reduction'),
    metric('before', '优化前 · P95', '420 ms', '95% 的请求在此时间内完成'),
    metric('after', '优化后 · P95', '180 ms', '同等测试条件'),
    metric('reduction', '耗时降低', '57.1%', '由示例数据计算'),
    section('results', '不同方案的响应时间', '数值越小，响应越快。性能结论需要可复现的测试条件。', [
      'chart',
      'conditions',
    ]),
    {
      id: 'chart',
      component: 'LingUI.BarChart',
      label: 'P95 响应时间',
      unit: 'ms',
      description: '演示数据 · 固定并发量 50',
      data: [
        { label: '原始查询', value: 420 },
        { label: '增加索引', value: 260 },
        { label: '索引 + 缓存', value: 180 },
      ],
    },
    {
      id: 'conditions',
      component: 'LingUI.KeyValue',
      label: '记录实验条件',
      entries: [
        { label: '测试流量', value: '每组 10,000 次请求，预热后采样；并发量保持一致。' },
        { label: '环境约束', value: '使用相同实例规格、数据集与网络环境。' },
        { label: '下一步', value: '替换为真实结果，并同时观察错误率、吞吐量与资源占用。' },
      ],
    },
  ])
}
