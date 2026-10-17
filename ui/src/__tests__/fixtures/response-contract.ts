import { serializeSource, type ComponentNode } from '@lingui/renderer'
import { createBlankDocument } from '../../component-studio/document-editor'

export function contractDocument() {
  const nodes: ComponentNode[] = [
    { id: 'root', component: 'Column', children: ['load', 'metric', 'list'] },
    {
      id: 'load',
      component: 'Button',
      child: 'label',
      events: { click: { actions: [{ type: 'api', name: 'weather', resultPath: '/response' }] } },
    },
    { id: 'label', component: 'Text', text: '加载天气' },
    {
      id: 'metric',
      component: 'LingUI.Metric',
      label: '温度',
      value: { path: '/response/temperature' },
    },
    {
      id: 'list',
      component: 'LingUI.BarChart',
      label: '天气趋势',
      data: [],
      bindings: { data: { path: '/response/items', map: { label: '/name', value: '/value' } } },
    },
  ]
  return {
    ...createBlankDocument(),
    source: serializeSource(nodes),
    state: { response: null },
    integrations: {
      apis: [
        {
          name: 'weather',
          label: '天气',
          url: 'https://api.example.com/weather',
          method: 'GET' as const,
          responseExample: { temperature: 21, items: [{ name: '今天', value: 1 }] },
        },
      ],
      callbacks: [],
    },
  }
}
