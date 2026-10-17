import type { Surface, JsonValue } from '../protocol/types'
import type { Runtime } from '../interaction-runtime/runtime'
import type { EventRuntime } from './runtime'
import type { ComponentEventName } from './types'
import { supportedEvents } from './capabilities'

const nativeEvents: Record<string, ComponentEventName> = {
  click: 'click',
  input: 'input',
  focusin: 'focus',
  focusout: 'blur',
  keydown: 'enter',
  load: 'load',
  loadeddata: 'load',
  error: 'error',
  play: 'play',
  pause: 'pause',
  ended: 'ended',
  timeupdate: 'timeUpdate',
  submit: 'submit',
  invalid: 'invalid',
}
/** Capture gives stopped events a route; execution runs after the control commits its native state. */
export function attachDomEvents(
  element: HTMLElement,
  options: { surface: Surface; runtime: Runtime; events: EventRuntime },
) {
  let active = true
  const listener = (native: Event) => {
    let event = nativeEvents[native.type]!
    if (
      native instanceof KeyboardEvent &&
      (native.key !== 'Enter' || native.isComposing || native.repeat)
    )
      return
    const target = native.target as HTMLElement
    if (target.closest?.(':disabled, [aria-disabled="true"]')) return
    if (native.type === 'click' && target.closest?.('[data-lingui-clear]')) event = 'clear'
    const owner = native.composedPath().find((item) => {
      if (!(item instanceof HTMLElement) || !item.dataset.linguiNode) return false
      const node = options.surface.nodes[item.dataset.linguiNode]
      return node && supportedEvents(node.component).includes(event)
    }) as HTMLElement | undefined
    if (!owner) return
    const node = options.surface.nodes[owner.dataset.linguiNode!]!
    if (node.readOnly && ['input', 'clear', 'enter'].includes(event)) return
    if (event === 'submit') native.preventDefault()
    queueMicrotask(() => {
      if (!active) return
      const field = target as HTMLInputElement
      const data: Record<string, JsonValue> = {
        value: node.value ? (options.runtime.resolve(node.value) ?? null) : null,
        ...(native.type === 'input' && typeof field.value === 'string'
          ? { text: field.value }
          : {}),
        ...(native instanceof KeyboardEvent ? { key: native.key } : {}),
        ...(['play', 'pause', 'ended', 'timeupdate'].includes(native.type)
          ? {
              currentTime: (target as HTMLMediaElement).currentTime,
              duration: Number.isFinite((target as HTMLMediaElement).duration)
                ? (target as HTMLMediaElement).duration
                : 0,
            }
          : {}),
      }
      if (event === 'submit')
        data.values = Object.fromEntries(
          Object.values(options.surface.nodes)
            .filter(
              (item) =>
                item.value &&
                owner.contains(element.querySelector(`[data-lingui-node="${item.id}"]`)),
            )
            .map((item) => [item.id, options.runtime.resolve(item.value) ?? null]),
        )
      if (event === 'invalid') data.message = field.validationMessage
      if (event === 'error')
        data.message =
          target instanceof HTMLMediaElement
            ? (target.error?.message ?? '媒体加载失败')
            : '资源加载失败'
      void options.events.fire(node, event, data)
      if (event === 'enter' && node.component === 'LingUI.SearchInput')
        void options.events.fire(node, 'search', data)
    })
  }
  for (const event of Object.keys(nativeEvents)) element.addEventListener(event, listener, true)
  return {
    destroy() {
      active = false
      for (const event of Object.keys(nativeEvents))
        element.removeEventListener(event, listener, true)
    },
  }
}
