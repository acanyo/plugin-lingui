import { column, document, grid, section, softCard, text } from './builders'

export function springFluxExample() {
  return document(
    'Spring WebFlux 原理图解',
    [
      column('root', ['intro', 'concepts', 'practice']),
      section(
        'intro',
        '理解 WebFlux，从一条数据流开始',
        '请求到达后，用声明式操作符连接处理过程；数据就绪时，再沿着流交给订阅者。',
        ['flow-card', 'signals'],
        'Spring · 响应式编程',
      ),
      softCard('flow-card', 'flow'),
      {
        id: 'flow',
        component: 'LingUI.Diagram',
        orientation: 'horizontal',
        children: ['publisher', 'operators', 'subscriber'],
      },
      {
        id: 'publisher',
        component: 'LingUI.DiagramNode',
        variant: 'stage',
        name: 'database',
        title: '发布数据',
        description: 'Flux / Mono',
      },
      {
        id: 'operators',
        component: 'LingUI.DiagramNode',
        variant: 'stage',
        name: 'layers',
        title: '变换与组合',
        description: 'map · filter · flatMap',
      },
      {
        id: 'subscriber',
        component: 'LingUI.DiagramNode',
        variant: 'stage',
        name: 'check',
        title: '消费结果',
        description: 'WebFlux 负责订阅',
      },
      {
        id: 'signals',
        component: 'LingUI.KeyValue',
        entries: [
          { label: '数据向下游', value: 'onNext 传递元素，onComplete 或 onError 结束流。' },
          { label: '需求向上游', value: '订阅者通过 request(n) 表达需求，用背压协调生产与消费。' },
        ],
      },
      section(
        'concepts',
        '三个关键概念',
        '响应式的价值在于组织异步工作，尤其是等待网络与数据库的时间。',
        ['concept-grid'],
      ),
      grid('concept-grid', ['lazy-card', 'io-card', 'pressure-card'], 3),
      softCard('lazy-card', 'lazy'),
      column('lazy', ['lazy-title', 'lazy-body']),
      text('lazy-title', '订阅后执行', 'h3'),
      text('lazy-body', '冷流通常在订阅时启动。仅定义操作链，并不会立即取出全部数据。'),
      softCard('io-card', 'io'),
      column('io', ['io-title', 'io-body']),
      text('io-title', '等待不占线程', 'h3'),
      text('io-body', '配合非阻塞驱动，让少量事件循环线程处理更多并发连接。'),
      softCard('pressure-card', 'pressure'),
      column('pressure', ['pressure-title', 'pressure-body']),
      text('pressure-title', '按需消费', 'h3'),
      text('pressure-body', '消费方声明处理能力。背压策略仍需结合数据源和操作符设计。'),
      section(
        'practice',
        '把原理放进一个接口',
        '返回 Flux，框架完成订阅和响应写出；业务代码描述数据如何流动。',
        ['code', 'details'],
      ),
      {
        id: 'code',
        component: 'LingUI.CodeBlock',
        label: 'ProductController.java',
        language: 'java',
        code: '@GetMapping(value = "/products",\n    produces = MediaType.TEXT_EVENT_STREAM_VALUE)\npublic Flux<Product> products() {\n    return repository.findAll()\n        .filter(Product::isAvailable)\n        .take(20);\n}',
      },
      {
        id: 'details',
        component: 'LingUI.Collapse',
        title: '使用时需要避开的两个误区',
        child: 'pitfalls',
        expanded: { path: '/details' },
      },
      {
        id: 'pitfalls',
        component: 'LingUI.KeyValue',
        entries: [
          {
            label: '阻塞调用',
            value:
              '不要在事件循环中调用 block() 或直接执行阻塞 JDBC。必要时隔离到有边界的专用调度器。',
          },
          {
            label: '性能预期',
            value: 'WebFlux 适合高并发 I/O；CPU 密集任务不会因为返回 Flux 就自动变快。',
          },
        ],
      },
    ],
    { details: false },
  )
}
