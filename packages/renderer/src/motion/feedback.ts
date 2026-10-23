import type { NodeMotion, MotionTiming } from './types'
import { motionAllowed, motionDuration, observeMotionPreference } from './preferences'

/** Feedback uses independent translate/scale properties so it composes with appearance transforms. */
export function attachMotionFeedback(element: Element, motion?: NodeMotion, enabled = true) {
  const hasFeedback = motion && (motion.hover || motion.focus || motion.press)
  if (!hasFeedback || typeof element.animate !== 'function') return () => {}
  let hovering = false,
    focusing = false,
    pressing = false
  let animation: Animation | undefined
  let previous: MotionTiming = {}
  const listeners: Array<[string, EventListener]> = []
  const doc = element.ownerDocument
  function stop() {
    animation?.cancel()
    animation = undefined
  }
  function render() {
    if (
      !motionAllowed(element, enabled) ||
      element.closest(':disabled, [aria-disabled="true"], [inert]')
    ) {
      stop()
      return
    }
    const hover = hovering ? motion?.hover : undefined
    const focus = focusing ? motion?.focus : undefined
    const press = pressing ? motion?.press : undefined
    const effect = press ?? focus ?? hover
    if (!effect && !animation) return
    const lift = [hover?.preset, focus?.preset].includes('lift')
    const grow = [hover?.preset, focus?.preset].includes('grow')
    const style = getComputedStyle(element)
    const from = {
      translate: style.translate === 'none' || !style.translate ? '0px 0px' : style.translate,
      scale: style.scale === 'none' || !style.scale ? '1' : style.scale,
    }
    stop()
    const current = element.animate(
      [
        from,
        { translate: lift ? '0px -4px' : '0px 0px', scale: press ? '0.97' : grow ? '1.02' : '1' },
      ],
      {
        duration: motionDuration(effect ?? previous, press ? 100 : 160),
        easing: (effect ?? previous).easing ?? 'ease-out',
        fill: 'forwards',
      },
    )
    animation = current
    if (effect) previous = { ...effect, duration: motionDuration(effect, press ? 100 : 160) }
    current.finished
      .then(() => {
        if (animation === current && !effect) stop()
      })
      .catch(() => {})
  }
  function listen(name: string, listener: (event: Event) => void) {
    element.addEventListener(name, listener)
    listeners.push([name, listener])
  }
  function release() {
    pressing = false
    doc.removeEventListener('pointerup', release, true)
    doc.removeEventListener('pointercancel', release, true)
    render()
  }
  listen('pointerenter', (event) => {
    if ((event as PointerEvent).pointerType !== 'mouse') return
    hovering = true
    render()
  })
  listen('pointerleave', () => {
    hovering = false
    pressing = false
    render()
  })
  listen('pointerdown', (event) => {
    if ((event as PointerEvent).button !== 0) return
    pressing = true
    doc.addEventListener('pointerup', release, true)
    doc.addEventListener('pointercancel', release, true)
    render()
  })
  listen('focusin', () => {
    focusing = true
    render()
  })
  listen('focusout', (event) => {
    const next = (event as FocusEvent).relatedTarget
    if (next instanceof Node && element.contains(next)) return
    focusing = false
    pressing = false
    render()
  })
  listen('keydown', (event) => {
    const key = event as KeyboardEvent
    if (!['Enter', ' '].includes(key.key) || key.repeat) return
    pressing = true
    render()
  })
  listen('keyup', (event) => {
    if (['Enter', ' '].includes((event as KeyboardEvent).key)) release()
  })
  const unobserve = observeMotionPreference(element, () => {
    if (!motionAllowed(element, enabled)) stop()
  })
  return () => {
    stop()
    unobserve()
    doc.removeEventListener('pointerup', release, true)
    doc.removeEventListener('pointercancel', release, true)
    for (const [name, listener] of listeners) element.removeEventListener(name, listener)
  }
}
