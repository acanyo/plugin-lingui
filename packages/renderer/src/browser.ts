import { registerCustomElements } from './mount/custom-elements'
// Vite resolves modular CSS into one stylesheet for the static article fallback.
import './renderer-core/renderer.css'
registerCustomElements()
export { registerInteractionCallback, registerInteractionRequests } from './events/registry'
