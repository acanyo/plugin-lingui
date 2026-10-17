import catalog from '@lingui/renderer/catalog'
import type { ComponentNode } from '@lingui/renderer'
interface Schema {
  type?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  $ref?: string
  oneOf?: Schema[]
}
export function mappingFields(node: ComponentNode, key: string) {
  const schemas = catalog as unknown as {
    components: Record<string, Schema>
    $defs: Record<string, Schema>
  }
  const resolve = (schema: Schema | undefined): Schema =>
    schema?.$ref ? resolve(schemas.$defs[schema.$ref.split('/').at(-1)!]) : (schema ?? {})
  const item = resolve(resolve(schemas.components[node.component]?.properties?.[key]).items)
  return Object.entries(item.properties ?? {}).map(([name, schema]) => ({
    name,
    type: resolve(schema).type ?? 'value',
    required: item.required?.includes(name) ?? false,
  }))
}
