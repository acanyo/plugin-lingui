import { mountRenderer, type RendererHandle } from './mount'
import type { InteractionHost } from '../events/types'
import { isComponentReference, loadComponentReference } from './reference'
export function registerCustomElements(): void {
  if (typeof customElements === 'undefined' || customElements.get('lingui-component')) return
  class LinguiElement extends HTMLElement {
    static observedAttributes = ['data-lingui']
    private handle?: RendererHandle
    private interactionHost: InteractionHost = {}
    private pending?: AbortController
    private generation = 0
    get interactions(): InteractionHost {
      return this.interactionHost
    }
    set interactions(value: InteractionHost) {
      this.interactionHost = value ?? {}
      this.handle?.setInteractions(this.hostOptions())
    }
    private hostOptions(): InteractionHost {
      const thisElement = this
      return {
        get motion() {
          return thisElement.interactionHost.motion
        },
        get autoStart() {
          return thisElement.interactionHost.autoStart
        },
        get trace() {
          return thisElement.interactionHost.trace
        },
        get inheritRegistered() {
          return thisElement.interactionHost.inheritRegistered
        },
        get callbacks() {
          return thisElement.interactionHost.callbacks
        },
        get requests() {
          return thisElement.interactionHost.requests
        },
        onEvent: (report) => {
          this.interactionHost.onEvent?.(report)
          this.dispatchEvent(
            new CustomEvent('lingui-event', { detail: report, bubbles: true, composed: true }),
          )
        },
      }
    }
    connectedCallback() {
      if (!this.pending) this.render()
    }
    disconnectedCallback() {
      this.cancelPending()
      const handle = this.handle
      this.handle = undefined
      void handle?.destroy()
    }
    attributeChangedCallback() {
      if (this.isConnected) this.render()
    }
    private render() {
      this.cancelPending()
      const value = (this.getAttribute('data-lingui') ?? '').trim()
      if (!isComponentReference(value)) {
        this.message('组件 ID 无效，请从项目重新复制嵌入标签。', false)
        return
      }
      void this.renderReference(value)
    }
    private cancelPending() {
      this.generation++
      this.pending?.abort()
      this.pending = undefined
    }
    private message(text: string, loading: boolean, retry = false) {
      if (this.handle) {
        void this.handle.destroy()
        this.handle = undefined
      }
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
      root.replaceChildren()
      const message = document.createElement('p')
      message.textContent = text
      message.setAttribute('role', loading ? 'status' : 'alert')
      root.append(message)
      if (retry) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = '重新加载组件'
        button.addEventListener('click', () => this.render())
        root.append(button)
      }
    }
    private async renderReference(name: string) {
      const generation = this.generation
      const controller = new AbortController()
      this.pending = controller
      this.message('正在加载组件…', true)
      const timeout = setTimeout(() => controller.abort(), 15000)
      try {
        const instance = await loadComponentReference(name, controller.signal)
        if (!this.isConnected || this.generation !== generation) return
        if (controller.signal.aborted) throw new Error('组件加载超时')
        this.handle = mountRenderer(this, instance, this.hostOptions())
      } catch (error) {
        if (!this.isConnected || this.generation !== generation) return
        const message = controller.signal.aborted
          ? '组件加载超时，请重试'
          : error instanceof Error
            ? error.message
            : '组件暂时无法加载'
        this.message(message, false, true)
      } finally {
        clearTimeout(timeout)
        if (this.pending === controller) this.pending = undefined
      }
    }
  }
  customElements.define('lingui-component', LinguiElement)
}
