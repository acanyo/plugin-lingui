import {
  resolveCollectionNode,
  type ComponentNode,
  type JsonValue,
  type Runtime,
} from '@lingui/renderer'
export function inputSamples(node: ComponentNode, runtime: Runtime): JsonValue[] {
  if (!node.value || typeof node.value !== 'object' || !('path' in node.value) || node.readOnly)
    return []
  const value = runtime.resolve(node.value)
  const options = resolveCollectionNode(node, runtime.state).node.options?.filter(
    (option) => !option.disabled,
  )
  if (options?.length)
    return options
      .slice(0, 6)
      .map((option) => (Array.isArray(value) ? [option.value] : option.value))
  if (['CheckBox', 'LingUI.Switch'].includes(node.component)) return [true, false]
  if (
    ['Slider', 'LingUI.NumberInput', 'LingUI.Rating', 'LingUI.Pagination'].includes(node.component)
  ) {
    const min =
      typeof node.min === 'number' ? node.min : node.component === 'LingUI.Pagination' ? 1 : 0
    const max =
      typeof node.max === 'number'
        ? node.max
        : (node.totalPages ??
          Math.max(min + (node.step ?? 1), typeof value === 'number' ? value : 1))
    return [...new Set([min, max])]
  }
  if (['TextField', 'LingUI.SearchInput', 'LingUI.Textarea'].includes(node.component))
    return [typeof value === 'string' && value ? value : '自检输入']
  return []
}
