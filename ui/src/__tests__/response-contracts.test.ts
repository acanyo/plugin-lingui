import { describe, expect, it } from 'vitest'
import { type ComponentNode } from '@lingui/renderer'
import { contractDocument } from './fixtures/response-contract'
import { responseChanges } from '../integrations/contracts/shape'
import { affectedBindings, apiDestinations } from '../integrations/contracts/impact'
import { dynamicPaths, replaceDynamicPaths } from '../data-binding/dynamic-paths'

describe('response structure diagnostics', () => {
  it('compares types rather than values and keeps null, zero and false distinct', () => {
    expect(responseChanges({ a: 0, b: false, c: null }, { a: 21, b: true, c: null })).toEqual([])
    expect(responseChanges({ a: 0, b: false }, { a: '0', c: null })).toEqual([
      { path: '/a', kind: 'type', before: '数字', after: '字符串' },
      { path: '/b', kind: 'missing', before: '布尔值' },
      { path: '/c', kind: 'added', after: 'null' },
    ])
  })
  it('reports parent changes once and does not invent missing row fields for empty arrays', () => {
    expect(responseChanges({ data: { items: [{ value: 1 }] } }, { data: null })).toEqual([
      { path: '/data', kind: 'type', before: '对象', after: 'null' },
    ])
    expect(responseChanges({ items: [{ value: 1 }] }, { items: [] })).toEqual([])
    expect(responseChanges({ data: { value: 1 } }, {})).toEqual([
      { path: '/data', kind: 'missing', before: '对象' },
    ])
  })
  it('escapes JSON pointers and checks array row types without reporting private values', () => {
    const changes = responseChanges(
      { 'a/b': [{ '~value': 1 }] },
      { 'a/b': [{ '~value': 'private' }] },
    )
    expect(changes).toEqual([
      { path: '/a~1b/*/~0value', kind: 'type', before: '数字', after: '字符串' },
    ])
    expect(JSON.stringify(changes)).not.toContain('private')
  })
  it('finds components bound to the affected API and wildcard collection fields', () => {
    const definition = contractDocument()
    expect(apiDestinations(definition, 'weather')).toEqual(['/response'])
    expect(affectedBindings(definition, 'weather', { path: '/temperature', kind: 'type' })).toEqual(
      [{ nodeId: 'metric', property: 'value', path: '/response/temperature' }],
    )
    expect(
      affectedBindings(definition, 'weather', { path: '/items/*/value', kind: 'missing' }),
    ).toEqual([{ nodeId: 'list', property: 'bindings.data', path: '/response/items' }])
    expect(
      affectedBindings(definition, 'other', { path: '/temperature', kind: 'missing' }),
    ).toEqual([])
    expect(affectedBindings(definition, 'weather', { path: '/extra', kind: 'added' })).toEqual([])
  })
  it('edits calculation references while retaining every operation and fallback', () => {
    const node: ComponentNode = {
      id: 'value',
      component: 'Text',
      text: {
        call: 'lingui.evaluate',
        args: { expression: { op: 'coalesce', args: [{ path: '/response/old' }, '暂无'] } },
      },
    }
    const before = JSON.stringify(node),
      paths = dynamicPaths(node)
    expect(paths).toHaveLength(1)
    const updated = replaceDynamicPaths(
      node,
      paths.map((item) => ({ ...item, path: '/response/new' })),
    )
    expect(JSON.stringify(updated.text)).toContain('coalesce')
    expect(JSON.stringify(updated.text)).toContain('暂无')
    expect(dynamicPaths(updated)[0]!.path).toBe('/response/new')
    expect(JSON.stringify(node)).toBe(before)
    expect(() => replaceDynamicPaths(node, [{ ...paths[0]!, path: '' }])).toThrow('以 / 开头')
  })
})
