import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { serializeSource, type ComponentNode } from '@lingui/renderer'
import DataBindingEditor from '../component-studio/DataBindingEditor.vue'
import MappingFields from '../data-binding/MappingFields.vue'
import { fields } from '../data-binding/fields'
import { dataSamples, sampleValue } from '../data-binding/samples'
import { mappingFields } from '../data-binding/mapping-schema'
import { checkContracts } from '../ai-adapter/contract-check'
import { createBlankDocument } from '../component-studio/document-editor'
let view: VueWrapper | undefined
afterEach(() => view?.unmount())
const chart: ComponentNode = {
  id: 'chart',
  component: 'LingUI.BarChart',
  label: '次数',
  data: [],
  bindings: { data: { path: '/response/items', map: { label: '/name', value: '/count' } } },
}
function definition() {
  return {
    ...createBlankDocument(),
    source: serializeSource([
      { id: 'root', component: 'Column', children: ['query', 'chart'] },
      {
        id: 'query',
        component: 'Button',
        child: 'title',
        events: { click: { actions: [{ type: 'api', name: 'search' }], resultPath: '/response' } },
      },
      { id: 'title', component: 'Text', text: '查询' },
      chart,
    ]),
    integrations: {
      apis: [
        {
          name: 'search',
          label: '查询',
          url: '/items',
          method: 'GET' as const,
          responseExample: { items: [{ name: 'Flux', count: 6 }] },
        },
      ],
      callbacks: [],
    },
  }
}
describe('visual response binding', () => {
  it('keeps existing array-field mappings editable and exposes per-column mappings', async () => {
    const node: ComponentNode = {
      id: 'table',
      component: 'LingUI.Table',
      label: '数据',
      columns: ['名称', '状态'],
      rows: [],
    }
    view = mount(MappingFields, {
      props: {
        node,
        property: 'rows',
        modelValue: '{"label":"/name","cells":"/values"}',
        record: { name: '作品', values: ['已上架'] },
      },
    })
    expect(view.get('input[aria-label="cells 数组字段"]').element).toHaveProperty(
      'value',
      '/values',
    )
    await view
      .findAll('button')
      .find((button) => button.text() === '改为逐列映射')!
      .trigger('click')
    expect(JSON.parse(view.emitted('update:modelValue')![0]![0] as string)).toEqual({
      label: '/name',
    })
    await view.setProps({ modelValue: '{"label":"/name","cells":["/values/0"]}' })
    expect(view.get('input[aria-label="cells 第 1 列"]').element).toHaveProperty(
      'value',
      '/values/0',
    )
  })
  it('escapes response keys and derives field contracts from the catalog', () => {
    expect(fields({ 'a/b': { '~value': 2 } }).map((field) => field.path)).toContain('/a~1b/~0value')
    expect(mappingFields(chart, 'data')).toEqual([
      { name: 'label', type: 'string', required: true },
      { name: 'value', type: 'number', required: true },
    ])
    expect(sampleValue(dataSamples(definition()), '/response/items')).toEqual([
      { name: 'Flux', count: 6 },
    ])
  })
  it('selects fields visually and previews the unsaved mapping without storing examples in state', async () => {
    const document = definition()
    view = mount(DataBindingEditor, { props: { node: chart, state: {}, document } })
    expect(view.get('input[aria-label="label 字段"]').element).toHaveProperty('value', '/name')
    await view.get('input[aria-label="value 字段"]').setValue('/missing')
    await view
      .findAll('button')
      .find((button) => button.text() === '应用数据绑定')!
      .trigger('click')
    expect(view.emitted('update')).toBeUndefined()
    expect(view.text()).toContain('不存在')
    await view.get('input[aria-label="value 字段"]').setValue('/count')
    await view
      .findAll('button')
      .find((button) => button.text() === '应用数据绑定')!
      .trigger('click')
    expect(view.emitted('update')![0]![0]).toMatchObject(chart)
    expect(view.text()).toContain('Flux')
    expect(document.state).toEqual({})
  })
  it('validates table columns, unknown dependencies and absent data independently', () => {
    expect(checkContracts(definition())).toEqual([])
    const missing = definition()
    missing.integrations.apis = []
    expect(checkContracts(missing)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'error', message: expect.stringContaining('未配置') }),
        expect.objectContaining({ level: 'warning' }),
      ]),
    )
    const wrong = definition()
    wrong.integrations.apis[0]!.responseExample.items[0]!.count = -1
    expect(checkContracts(wrong)).toEqual(
      expect.arrayContaining([expect.objectContaining({ level: 'error' })]),
    )
  })
  it('uses transient test results ahead of examples and detects a missing known response field', () => {
    const document = definition()
    const observed = dataSamples(document, { search: { items: [{ name: '真实测试', count: 9 }] } })
    expect(sampleValue(observed, '/response/items')).toEqual([{ name: '真实测试', count: 9 }])
    expect(document.integrations.apis[0]!.responseExample.items[0]!.name).toBe('Flux')
    document.source = document.source.replace('/response/items', '/response/missing')
    expect(checkContracts(document)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'error', message: expect.stringContaining('不存在于') }),
      ]),
    )
  })
})
