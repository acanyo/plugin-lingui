import { renderStatic, type ComponentInstance } from '@lingui/renderer'

export async function staticPreview(instance: ComponentInstance): Promise<HTMLElement> {
  const element = document.createElement('div')
  element.innerHTML = await renderStatic(instance)
  return element
}
