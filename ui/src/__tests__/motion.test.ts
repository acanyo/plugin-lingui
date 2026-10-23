import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createInstance,
  renderStatic,
  validateDocument,
  type ComponentNode,
} from '@lingui/renderer'
import { document, text } from '../../../packages/renderer/src/examples/builders'
import { attachMotionFeedback } from '../../../packages/renderer/src/motion/feedback'
import { attachDetailsMotion } from '../../../packages/renderer/src/motion/details'
import { appearanceTransition } from '../../../packages/renderer/src/motion/appearance'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.document.body.replaceChildren()
})
function animationMock(element: Element) {
  const runs: Array<{ cancel: ReturnType<typeof vi.fn>; complete: () => void }> = []
  const animate = vi.fn(
    (
      _frames: Keyframe[] | PropertyIndexedKeyframes | null,
      _options?: number | KeyframeAnimationOptions,
    ) => {
      let complete!: () => void
      const finished = new Promise<void>((resolve) => {
        complete = resolve
      })
      const cancel = vi.fn()
      runs.push({ cancel, complete })
      return { finished, cancel } as unknown as Animation
    },
  )
  Object.defineProperty(element, 'animate', { configurable: true, value: animate })
  return { runs, animate }
}
function pointer(element: Element, name: string, pointerType = 'mouse') {
  const event = new MouseEvent(name, { bubbles: true, button: 0 })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  element.dispatchEvent(event)
}
describe('bounded motion protocol', () => {
  it('accepts preset animations and rejects code, invalid durations and unsupported state transitions', () => {
    const node = {
      ...text('root', '内容'),
      motion: {
        enter: { preset: 'fade-up', duration: 300 },
        hover: { preset: 'lift' },
        press: { preset: 'scale-down' },
      },
    } as ComponentNode
    expect(() => validateDocument(document('动画', [node]))).not.toThrow()
    for (const motion of [
      { enter: { preset: 'custom' } },
      { enter: { preset: 'fade', duration: -1 } },
      { enter: { preset: 'fade', duration: 2001 } },
      { enter: { preset: 'fade', delay: 0.5 } },
      { hover: { preset: 'lift', keyframes: [] } },
      { press: { preset: 'grow' } },
      { enter: { preset: 'fade', easing: 'function(){}' } },
      { transition: { duration: 200 } },
    ])
      expect(() =>
        validateDocument(document('动画', [{ ...node, motion } as ComponentNode])),
      ).toThrow()
  })
  it('exports fully visible static content with motion disabled', async () => {
    const html = await renderStatic(
      createInstance(
        document('静态动画', [
          { ...text('root', '可读内容'), motion: { enter: { preset: 'fade', delay: 2000 } } },
        ]),
      ),
    )
    expect(html).toContain('可读内容')
    expect(html).not.toContain('opacity: 0')
  })
  it('skips appearance motion for reduced-motion preferences and explicit host settings', () => {
    const element = window.document.createElement('div')
    animationMock(element)
    expect(appearanceTransition(element, { preset: 'fade', duration: 0, delay: 2000 })).toEqual({
      duration: 0,
    })
    expect(appearanceTransition(element, { preset: 'fade' }, false).duration).toBe(0)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(appearanceTransition(element, { preset: 'fade' }).duration).toBe(0)
  })
})
describe('feedback animation lifecycle', () => {
  it('composes hover and press, restores on release and removes listeners on destroy', () => {
    const element = window.document.createElement('button')
    window.document.body.append(element)
    const { animate, runs } = animationMock(element)
    const destroy = attachMotionFeedback(element, {
      hover: { preset: 'lift' },
      press: { preset: 'scale-down' },
    })
    pointer(element, 'pointerenter')
    pointer(element, 'pointerdown')
    expect(animate.mock.calls.at(-1)?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ translate: '0px -4px', scale: '0.97' })]),
    )
    pointer(window.document.body, 'pointerup')
    expect(animate.mock.calls.at(-1)?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ scale: '1' })]),
    )
    destroy()
    const calls = animate.mock.calls.length
    pointer(element, 'pointerenter')
    expect(animate).toHaveBeenCalledTimes(calls)
    expect(runs.every((run) => run.cancel.mock.calls.length > 0)).toBe(true)
  })
  it('avoids sticky touch hover and ignores disabled controls', () => {
    const element = window.document.createElement('button')
    const { animate } = animationMock(element)
    const destroy = attachMotionFeedback(element, {
      hover: { preset: 'lift' },
      press: { preset: 'scale-down' },
    })
    pointer(element, 'pointerenter', 'touch')
    element.disabled = true
    pointer(element, 'pointerdown', 'touch')
    expect(animate).not.toHaveBeenCalled()
    destroy()
  })
})
describe('native disclosure transitions', () => {
  it('keeps a closing disclosure open but inert, and ignores stale animation completions after reversal', async () => {
    const element = window.document.createElement('details')
    element.innerHTML = '<summary>展开</summary><div><button>内容</button></div>'
    window.document.body.append(element)
    const content = element.querySelector('div')!
    const { runs } = animationMock(content)
    const controller = attachDetailsMotion(element, { expanded: true, transition: {} }, () => true)
    controller.update({ expanded: false, transition: {} })
    expect(element.open).toBe(true)
    expect(content.inert).toBe(true)
    controller.update({ expanded: true, transition: {} })
    runs[0]!.complete()
    await Promise.resolve()
    expect(element.open).toBe(true)
    expect(content.inert).toBe(false)
    controller.update({ expanded: false, transition: {} })
    runs.at(-1)!.complete()
    await Promise.resolve()
    expect(element.open).toBe(false)
    controller.destroy()
  })
})
