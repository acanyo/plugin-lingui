import type { MotionTiming } from './types'
import { motionAllowed, motionDuration, observeMotionPreference } from './preferences'

export interface TabMotionOptions {
  active: boolean
  transition?: MotionTiming
}

/** A tab switch keeps only its active panel in layout and animates the new panel. */
export function attachTabMotion(
  element: HTMLElement,
  initial: TabMotionOptions,
  enabled: () => boolean,
) {
  let active = initial.active
  let animation: Animation | undefined
  element.hidden = !active
  const stop = () => {
    animation?.cancel()
    animation = undefined
  }
  const unobserve = observeMotionPreference(element, () => {
    if (!motionAllowed(element, enabled())) stop()
  })
  return {
    update(options: TabMotionOptions) {
      const changed = options.active !== active
      active = options.active
      element.hidden = !active
      if (!changed) return
      stop()
      if (
        !active ||
        !options.transition ||
        !motionAllowed(element, enabled()) ||
        typeof element.animate !== 'function'
      )
        return
      animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: motionDuration(options.transition, 240),
        easing: options.transition.easing ?? 'ease-out',
      })
    },
    destroy() {
      stop()
      unobserve()
    },
  }
}
