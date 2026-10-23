import type { MotionTiming } from './types'
import { motionAllowed, motionDuration, observeMotionPreference } from './preferences'

export interface DetailsMotionOptions {
  expanded: boolean
  transition?: MotionTiming
}

/** Keep native details open during its closing animation; hidden content cannot receive input. */
export function attachDetailsMotion(
  element: HTMLDetailsElement,
  initial: DetailsMotionOptions,
  enabled: () => boolean,
) {
  const content = [...element.children].find(
    (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'DIV',
  )!
  let options = initial
  let animation: Animation | undefined
  let version = 0
  function finish() {
    version++
    animation?.cancel()
    animation = undefined
    element.open = options.expanded
    content.inert = !options.expanded
    content.setAttribute('aria-hidden', String(!options.expanded))
  }
  finish()
  const unobserve = observeMotionPreference(element, () => {
    if (!motionAllowed(element, enabled())) finish()
  })
  return {
    update(next: DetailsMotionOptions) {
      const changed = next.expanded !== options.expanded
      options = next
      if (
        !changed ||
        !next.transition ||
        !motionAllowed(element, enabled()) ||
        typeof content.animate !== 'function' ||
        motionDuration(next.transition, 240) === 0
      ) {
        finish()
        return
      }
      const currentHeight = element.open ? content.getBoundingClientRect().height : 0
      const currentStyle = getComputedStyle(content)
      const opacity = element.open ? currentStyle.opacity || '1' : '0'
      const paddingTop = element.open ? currentStyle.paddingTop : '0px'
      const paddingBottom = element.open ? currentStyle.paddingBottom : '0px'
      version++
      const run = version
      animation?.cancel()
      element.open = true
      content.inert = !next.expanded
      content.setAttribute('aria-hidden', String(!next.expanded))
      const target = getComputedStyle(content)
      animation = content.animate(
        [
          {
            height: `${currentHeight}px`,
            opacity,
            paddingTop,
            paddingBottom,
            overflow: 'hidden',
            boxSizing: 'border-box',
          },
          {
            height: `${next.expanded ? content.getBoundingClientRect().height : 0}px`,
            opacity: next.expanded ? '1' : '0',
            paddingTop: next.expanded ? target.paddingTop : '0px',
            paddingBottom: next.expanded ? target.paddingBottom : '0px',
            overflow: 'hidden',
            boxSizing: 'border-box',
          },
        ],
        {
          duration: motionDuration(next.transition, 240),
          easing: next.transition.easing ?? 'ease-out',
          fill: 'both',
        },
      )
      animation.finished
        .then(() => {
          if (version === run) finish()
        })
        .catch(() => {})
    },
    destroy() {
      version++
      animation?.cancel()
      unobserve()
    },
  }
}
