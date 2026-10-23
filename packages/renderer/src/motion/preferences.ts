import type { MotionTiming } from './types'

export function motionAllowed(element: Element, enabled = true): boolean {
  return (
    enabled &&
    !element.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}
export function motionDuration(effect: MotionTiming, fallback: number): number {
  return effect.duration ?? fallback
}
export function observeMotionPreference(element: Element, onChange: () => void): () => void {
  const media = element.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}
