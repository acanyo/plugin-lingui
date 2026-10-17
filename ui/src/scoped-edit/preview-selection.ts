import { onBeforeUnmount, watch, type Ref } from 'vue'

/** Capture inside the shadow tree, before controls can issue requests or change state. */
export function usePreviewSelection(
  host: Ref<HTMLElement | undefined>,
  active: () => boolean,
  selected: () => string | undefined,
  pick: (id: string) => void,
  cancel: () => void,
) {
  let shadow: ShadowRoot | undefined
  let cleanup = () => {}
  const blockedEvents = [
    'click',
    'dblclick',
    'auxclick',
    'contextmenu',
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'touchstart',
    'touchend',
    'keydown',
    'keyup',
    'beforeinput',
    'input',
    'change',
    'submit',
    'focus',
    'blur',
    'focusin',
    'focusout',
    'dragstart',
    'drop',
    'invalid',
    'reset',
    'search',
    'select',
    'load',
    'loadeddata',
    'loadedmetadata',
    'error',
    'play',
    'pause',
    'ended',
    'timeupdate',
    'toggle',
    'beforetoggle',
  ]
  function mark(attribute: string, id?: string) {
    for (const element of shadow?.querySelectorAll(`[${attribute}]`) ?? [])
      element.removeAttribute(attribute)
    if (id)
      for (const element of shadow?.querySelectorAll<HTMLElement>('[data-lingui-node]') ?? [])
        if (element.dataset.linguiNode === id) element.setAttribute(attribute, '')
  }
  function hit(event: Event) {
    return event
      .composedPath()
      .find((item): item is HTMLElement => item instanceof HTMLElement && !!item.dataset.linguiNode)
      ?.dataset.linguiNode
  }
  function intercept(event: Event) {
    if (!active()) return
    event.stopImmediatePropagation()
    // Keep Tab navigation available; all author-defined key handlers remain blocked.
    if (!(event instanceof KeyboardEvent && event.key === 'Tab')) event.preventDefault()
    if (event.type === 'click') {
      const id = hit(event)
      if (id) pick(id)
    }
    if (event instanceof KeyboardEvent && event.key === 'Escape') cancel()
  }
  function hover(event: Event) {
    if (active()) mark('data-lingui-pick-hover', hit(event))
  }
  function refresh() {
    const next = host.value?.shadowRoot ?? undefined
    if (next !== shadow) {
      cleanup()
      shadow = next
      if (shadow) {
        const root = shadow
        const style = document.createElement('style')
        style.textContent = `:host([data-lingui-picking]) [data-lingui-node] { cursor: crosshair !important; }
          [data-lingui-pick-hover] { outline: 1px dashed #2563eb !important; outline-offset: 2px; }
          [data-lingui-pick-selected] { outline: 2px solid #2563eb !important; outline-offset: 3px; }`
        root.append(style)
        blockedEvents.forEach((name) =>
          root.addEventListener(name, intercept, { capture: true, passive: false }),
        )
        root.addEventListener('pointerover', hover, true)
        root.addEventListener('pointerleave', leave, true)
        cleanup = () => {
          blockedEvents.forEach((name) => root.removeEventListener(name, intercept, true))
          root.removeEventListener('pointerover', hover, true)
          root.removeEventListener('pointerleave', leave, true)
          style.remove()
          mark('data-lingui-pick-selected')
          mark('data-lingui-pick-hover')
        }
      }
    }
    host.value?.toggleAttribute('data-lingui-picking', active())
    mark('data-lingui-pick-selected', selected())
    if (!active()) leave()
  }
  function leave() {
    mark('data-lingui-pick-hover')
  }
  watch([active, selected], refresh, { flush: 'post' })
  onBeforeUnmount(() => cleanup())
  return { refresh }
}
