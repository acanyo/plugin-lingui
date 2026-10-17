/** Let an expanded control handle Escape before an enclosing dialog. */
export function bindEscapeScope(element: HTMLElement, isOpen: () => boolean, close: () => void) {
  let consume = false
  function keydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !isOpen()) return
    consume = true
    event.preventDefault()
    event.stopPropagation()
    close()
  }
  function keyup(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !consume) return
    consume = false
    event.stopPropagation()
  }
  element.addEventListener('keydown', keydown)
  element.addEventListener('keyup', keyup)
  return () => {
    element.removeEventListener('keydown', keydown)
    element.removeEventListener('keyup', keyup)
  }
}
