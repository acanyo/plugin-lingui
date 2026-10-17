import { isComponentReference, type ComponentInstance } from '@lingui/renderer'

export interface LinguiNodeAttributes {
  componentId: string
}

export function nodeAttributes(instance: ComponentInstance): LinguiNodeAttributes {
  if (!instance.templateId || !isComponentReference(instance.templateId))
    throw new Error('请先将组件保存为项目，再插入文章')
  return { componentId: instance.templateId }
}
