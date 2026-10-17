import { isComponentReference } from '@lingui/renderer'

export function componentReferenceHtml(name: string): string {
  if (!isComponentReference(name)) throw new Error('组件 ID 无效')
  return `<lingui-component data-lingui="${name}"></lingui-component>`
}
