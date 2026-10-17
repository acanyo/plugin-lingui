import { parseSource, serializeSource } from '@lingui/renderer'
import { describe, expect, it } from 'vitest'
import {
  CATALOG_ID,
  componentNames,
  componentRegistry,
  createInstance,
  decodeInstance,
  encodeInstance,
  examples,
  resolveDocument,
  importDocument,
  pureTheme,
  validateDocument,
  validateTheme,
  type ComponentNode,
} from '@lingui/renderer'
import { document, column, text } from '../../../packages/renderer/src/examples/builders'
import generationExample from '../../../packages/renderer/src/examples/generation-example.json'
function mutate(node: Partial<ComponentNode>) {
  const value = examples[0]!.create()
  const nodes = parseSource(value.source)
  Object.assign(nodes[0]!, node)
  value.source = serializeSource(nodes)
  return value
}
describe('OpenUI document and security', () => {
  it('validates the shared example supplied to Halo and external AI prompts', () => {
    const definition = validateDocument(generationExample)
    expect(resolveDocument(definition).state.open).toBe(false)
    expect(definition.schemaVersion).toBe('lingui.document/2')
  })
  it.each(examples.map((example) => [example.id, example.create] as const))(
    'validates and restores %s',
    (_id, create) => {
      const definition = validateDocument(create())
      expect(resolveDocument(definition).nodes.root).toBeDefined()
      const instance = createInstance(definition)
      expect(decodeInstance(encodeInstance(instance))).toEqual(instance)
    },
  )
  it('registers an implementation for every allowed catalog component', () => {
    expect(Object.keys(componentRegistry).sort()).toEqual([...componentNames].sort())
  })
  it('rejects mismatched table rows and executable table fields', () => {
    const table: ComponentNode = {
      id: 'root',
      component: 'LingUI.Table',
      label: '对比',
      columns: ['维度', '方案'],
      rows: [{ label: '价格', cells: ['10', '20'] }],
    }
    expect(() => validateDocument(document('表格', [table]))).toThrow('列数不一致')
    table.rows![0]!.cells = ['<img src=x onerror=alert(1)>']
    expect(() => validateDocument(document('表格', [table]))).not.toThrow()
    expect(() =>
      validateDocument(
        document('表格', [{ ...table, html: '<script>bad()</script>' } as ComponentNode]),
      ),
    ).toThrow('属性')
  })
  it('rejects unknown component fields and executable content', () => {
    expect(() =>
      validateDocument(mutate({ html: '<script>bad()</script>' } as Partial<ComponentNode>)),
    ).toThrow('属性')
    expect(() =>
      validateDocument(mutate({ component: 'Script' } as unknown as Partial<ComponentNode>)),
    ).toThrow('属性')
  })
  it('accepts legacy tree diagrams and rejects unregistered diagram presentation', () => {
    const legacy = document('旧架构图', [
      { id: 'root', component: 'LingUI.Diagram', children: ['node'] },
      { id: 'node', component: 'LingUI.DiagramNode', title: '旧节点' },
    ])
    expect(() => validateDocument(legacy)).not.toThrow()
    const nodes = parseSource(legacy.source)
    nodes[1]!.variant = 'arbitrary-css'
    expect(() => validateDocument({ ...legacy, source: serializeSource(nodes) })).toThrow('属性')
    nodes[1]!.variant = 'group'; nodes[1]!.name = 'remote-svg'
    expect(() => validateDocument({ ...legacy, source: serializeSource(nodes) })).toThrow('属性')
  })
  it('rejects network events and unknown local functions', () => {
    const value = examples[2]!.create()
    const nodes = parseSource(value.source)
    ;(nodes.find((node) => node.id === 'submit') as unknown as { action: unknown }).action = { event: { name: 'fetch' } }
    value.source = serializeSource(nodes)
    expect(() => validateDocument(value)).toThrow('属性')
  })
  it('rejects unsafe paths and prototype pollution', () => {
    expect(() => importDocument('{"__proto__":{"polluted":true}}')).toThrow('不安全')
    expect(() => validateDocument(mutate({ expanded: { path: '/constructor/x' } }))).toThrow(
      '不安全',
    )
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
  it('rejects missing references, cycles and duplicate IDs', () => {
    expect(() => validateDocument(document('missing', [column('root', ['missing'])]))).toThrow(
      '不存在',
    )
    expect(() => validateDocument(document('cycle', [column('root', ['root'])]))).toThrow('循环')
    expect(() =>
      validateDocument(document('duplicate', [text('root', 'a'), text('root', 'b')])),
    ).toThrow('重复')
  })
  it('rejects unsupported document versions and executable source', () => {
    const value = examples[0]!.create()
    expect(() => validateDocument({ ...value, schemaVersion: 'unknown' })).toThrow('版本')
    expect(() => validateDocument({ ...value, source: 'root = fetch("https://example.com")' })).toThrow()
  })
  it('bounds oversized imports and expensive reference expansion', () => {
    expect(() => importDocument(' '.repeat(262145))).toThrow('256')
    const nodes = Array.from({ length: 16 }, (_, index) =>
      column(
        index === 0 ? 'root' : `n${index}`,
        index === 15 ? [] : [`n${index + 1}`, `n${index + 1}`],
      ),
    )
    expect(() => validateDocument(document('budget', nodes))).toThrow('展开次数')
  })
  it('imports the complete OpenUI document and preserves state', () => {
    const value = examples[0]!.create()
    expect(importDocument(JSON.stringify(value))).toEqual(value)
  })
  it('applies component and data edits without protocol envelopes', () => {
    const value = document('edited', [column('root', ['title']), text('title', 'before')], { nested: { value: 1 } })
    const nodes = parseSource(value.source); nodes[1]!.text = 'after'
    value.source = serializeSource(nodes); value.state = { nested: { value: 2 } }
    const result = resolveDocument(validateDocument(value))
    expect(result.nodes.title!.text).toBe('after'); expect(result.state.nested).toEqual({ value: 2 })
  })
  it('validates theme values and preserves instance snapshots', () => {
    expect(() =>
      validateTheme({ ...pureTheme, colors: { ...pureTheme.colors, accent: 'url(https://bad)' } }),
    ).toThrow('颜色')
    expect(() => validateTheme({ ...pureTheme, radius: 100 })).toThrow('范围')
    const definition = examples[0]!.create()
    const instance = createInstance(definition)
    definition.title = 'changed'
    expect(instance.document.title).toBe('重要提示')
  })
})
