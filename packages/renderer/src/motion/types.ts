export type MotionEasing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
export interface MotionTiming {
  duration?: number
  easing?: MotionEasing
}
export interface AppearanceMotion extends MotionTiming {
  preset: 'fade' | 'fade-up' | 'fade-down' | 'zoom'
  delay?: number
}
export interface FeedbackMotion extends MotionTiming {
  preset: 'lift' | 'grow'
}
export interface NodeMotion {
  enter?: AppearanceMotion
  exit?: AppearanceMotion
  hover?: FeedbackMotion
  focus?: FeedbackMotion
  press?: MotionTiming & { preset: 'scale-down' }
  /** Animate expanded content or a newly selected tab; only supported by those components. */
  transition?: MotionTiming
}
