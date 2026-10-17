import { describe, expect, it } from 'vitest'
import { componentReferenceHtml } from '../component-embed/html'

describe('project reference tags', () => {
  it('contains only a validated project ID and no serialized data or resource bundles', () => {
    expect(componentReferenceHtml('component-weather')).toBe(
      '<lingui-component data-lingui="component-weather"></lingui-component>',
    )
  })
  it.each(['', '{}', 'invalid id', '../weather', 'a" onclick="alert(1)', 'a'.repeat(81)])(
    'rejects invalid ID %s',
    (id) => {
      expect(() => componentReferenceHtml(id)).toThrow('组件 ID 无效')
    },
  )
})
