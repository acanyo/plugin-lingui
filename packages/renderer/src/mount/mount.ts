import { flushSync, mount, unmount } from 'svelte'
import Renderer from '../renderer-core/LinguiRenderer.svelte'
import css from '../renderer-core/renderer.css?inline'
import type { ComponentInstance } from '../protocol/types'
import type { InteractionHost } from '../events/types'
import { validateInstance } from '../protocol/instance'
import { createRendererProps } from './props.svelte'
import { registerFont, fontFamilyName } from '../fonts/runtime'
export interface RendererHandle {
  update(instance: ComponentInstance): void
  setInteractions(interactions: InteractionHost): void
  destroy(): Promise<void>
}
export function mountRenderer(
  host: HTMLElement,
  instance: ComponentInstance,
  interactions: InteractionHost = {},
): RendererHandle {
  return mountValidatedRenderer(host, validateInstance(instance), interactions)
}
function mountValidatedRenderer(
  host: HTMLElement,
  instance: ComponentInstance,
  interactions: InteractionHost,
): RendererHandle {
  const safe = validateInstance(instance)
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  shadow.replaceChildren()
  const style = document.createElement('style')
  style.textContent = css
  const target = document.createElement('div')
  shadow.append(style, target)
  const dark = () =>
    document.documentElement.classList.contains('dark') ||
    document.documentElement.dataset.theme === 'dark' ||
    document.documentElement.dataset.colorScheme === 'dark'
  const props = createRendererProps(safe, dark(), interactions)
  let fontKey = safe.theme.customFont ? fontFamilyName(safe.theme.customFont) : ''
  let releaseFont = registerFont(safe.theme.customFont, host.ownerDocument)
  let component: ReturnType<typeof mount>
  flushSync(() => {
    component = mount(Renderer, { target, props })
  })
  const observer = new MutationObserver(() => {
    props.hostDark = dark()
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-color-scheme'],
  })
  return {
    setInteractions(value) {
      flushSync(() => {
        props.interactions = value
      })
    },
    update(value) {
      const next = validateInstance(value)
      const nextFontKey = next.theme.customFont ? fontFamilyName(next.theme.customFont) : ''
      if (nextFontKey !== fontKey) {
        const releaseNext = registerFont(next.theme.customFont, host.ownerDocument)
        releaseFont()
        releaseFont = releaseNext
        fontKey = nextFontKey
      }
      flushSync(() => {
        props.instance = next
      })
    },
    async destroy() {
      observer.disconnect()
      await unmount(component)
      releaseFont()
      target.remove()
      style.remove()
    },
  }
}
/** Produce readable fallback from the exact same registered Svelte components. */
export async function renderStatic(instance: ComponentInstance): Promise<string> {
  const host = document.createElement('div')
  const handle = mountRenderer(host, instance, {
    autoStart: false,
    inheritRegistered: false,
    requests: { allow: () => false },
  })
  const surface = host.shadowRoot!.querySelector<HTMLElement>('.lingui-surface')!
  for (const input of surface.querySelectorAll<HTMLInputElement>('input')) {
    if (input.type === 'checkbox' || input.type === 'radio') {
      if (input.checked) input.setAttribute('checked', '')
      else input.removeAttribute('checked')
    } else input.setAttribute('value', input.type === 'password' ? '' : input.value)
    input.setAttribute('disabled', '')
  }
  for (const textarea of surface.querySelectorAll('textarea')) textarea.textContent = textarea.value
  for (const select of surface.querySelectorAll('select')) {
    for (const option of select.options) option.toggleAttribute('selected', option.selected)
    select.setAttribute('disabled', '')
  }
  for (const button of surface.querySelectorAll('button')) button.setAttribute('disabled', '')
  const clone = host
    .shadowRoot!.querySelector<HTMLElement>('.lingui-container')!
    .cloneNode(true) as HTMLElement
  for (const textarea of clone.querySelectorAll('textarea')) textarea.setAttribute('disabled', '')
  // Offline field values remain readable; interactive overlays and their ARIA links are removed.
  for (const panel of clone.querySelectorAll('.lg-select-panel')) panel.remove()
  for (const trigger of clone.querySelectorAll('[aria-haspopup], [role="combobox"]')) {
    for (const attribute of [
      'role',
      'aria-haspopup',
      'aria-expanded',
      'aria-controls',
      'aria-activedescendant',
      'aria-readonly',
    ])
      trigger.removeAttribute(attribute)
  }
  for (const dialog of clone.querySelectorAll('dialog')) {
    const details = document.createElement('details')
    details.className = 'lg-modal-fallback'
    const summary = document.createElement('summary')
    summary.textContent = dialog.querySelector('h2')?.textContent ?? '详细内容'
    details.append(summary)
    const content = dialog.querySelector('.lg-dialog-content')
    if (content) details.append(content)
    dialog.replaceWith(details)
  }
  for (const tooltip of clone.querySelectorAll<HTMLElement>('.lg-tooltip-content')) {
    tooltip.hidden = false
    tooltip.classList.add('lg-tooltip-fallback')
  }
  for (const slide of clone.querySelectorAll<HTMLElement>('.lg-carousel-slide'))
    slide.hidden = false
  for (const region of clone.querySelectorAll<HTMLElement>('.lg-scroll-area'))
    region.classList.add('lg-scroll-static')
  for (const pane of clone.querySelectorAll<HTMLElement>('.lg-split-panels'))
    pane.classList.add('lg-split-static')
  for (const panel of clone.querySelectorAll<HTMLElement>('.lg-popover-panel')) {
    panel.hidden = false
    panel.removeAttribute('popover')
    panel.classList.add('lg-popover-static')
  }
  const html = clone.outerHTML
  await handle.destroy()
  return html
}
