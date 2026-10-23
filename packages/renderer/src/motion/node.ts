import { useRenderer } from '../renderer-core/context'
import { appearanceTransition } from './appearance'
import { attachMotionFeedback } from './feedback'
import { attachDetailsMotion, type DetailsMotionOptions } from './details'
import { attachTabMotion, type TabMotionOptions } from './tabs'
import type { AppearanceMotion, NodeMotion } from './types'

/** Bind the shared effects to this renderer's explicit motion preference. */
export function createNodeMotion() {
  const { motionEnabled } = useRenderer()
  const appearance = (element: Element, effect?: AppearanceMotion) =>
    appearanceTransition(element, effect, motionEnabled())
  return {
    motionEnter: appearance,
    motionExit: appearance,
    motionFeedback(element: Element, motion?: NodeMotion) {
      let destroy = attachMotionFeedback(element, motion, motionEnabled())
      return {
        update(next?: NodeMotion) {
          destroy()
          destroy = attachMotionFeedback(element, next, motionEnabled())
        },
        destroy: () => destroy(),
      }
    },
    motionDetails(element: HTMLDetailsElement, options: DetailsMotionOptions) {
      return attachDetailsMotion(element, options, motionEnabled)
    },
    motionTab(element: HTMLElement, options: TabMotionOptions) {
      return attachTabMotion(element, options, motionEnabled)
    },
  }
}
