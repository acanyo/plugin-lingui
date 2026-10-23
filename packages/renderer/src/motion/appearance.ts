import { cubicIn, cubicOut, cubicInOut, linear } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'
import type { AppearanceMotion, MotionEasing } from './types'
import { motionAllowed, motionDuration } from './preferences'

const easings: Record<MotionEasing, (value: number) => number> = {
  linear,
  ease: cubicInOut,
  'ease-in': cubicIn,
  'ease-out': cubicOut,
  'ease-in-out': cubicInOut,
}

/** Svelte owns the animation and retains outgoing DOM until this transition finishes. */
export function appearanceTransition(
  element: Element,
  effect: AppearanceMotion | undefined,
  enabled = true,
): TransitionConfig {
  // Svelte supplies {} when a transition parameter is absent.
  if (!effect?.preset || !motionAllowed(element, enabled) || typeof element.animate !== 'function')
    return { duration: 0 }
  const duration = motionDuration(effect, 240)
  if (duration === 0) return { duration: 0 }
  const style = getComputedStyle(element)
  const opacity = Number(style.opacity || 1)
  const transform = style.transform === 'none' ? '' : style.transform
  const distance = effect.preset === 'fade-up' ? 16 : effect.preset === 'fade-down' ? -16 : 0
  return {
    duration,
    delay: effect.delay ?? 0,
    easing: easings[effect.easing ?? 'ease-out'],
    css: (t, u) =>
      `opacity:${t * opacity};transform:${transform} translateY(${u * distance}px) scale(${effect.preset === 'zoom' ? 0.96 + t * 0.04 : 1})`,
  }
}
