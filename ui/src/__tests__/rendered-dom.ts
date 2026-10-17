/** Official Web Components own nested shadow roots; selectors must cross each one. */
export function renderedElement<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T | null {
  const match = root.querySelector<T>(selector)
  if (match) return match
  for (const child of Array.from(root.querySelectorAll('*'))) {
    if (child.shadowRoot) {
      const found = renderedElement<T>(child.shadowRoot, selector)
      if (found) return found
    }
  }
  return null
}
