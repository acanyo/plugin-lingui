import type { JsonValue, LocalAction, State } from '../protocol/types'

export const eventNames = [
  'mount',
  'retry',
  'click',
  'input',
  'change',
  'focus',
  'blur',
  'enter',
  'search',
  'clear',
  'select',
  'open',
  'close',
  'confirm',
  'cancel',
  'add',
  'remove',
  'reorder',
  'move',
  'submit',
  'invalid',
  'load',
  'error',
  'play',
  'pause',
  'ended',
  'timeUpdate',
] as const
export type ComponentEventName = (typeof eventNames)[number]
export type EventAction =
  | { type: 'api'; name: string; args?: JsonValue; timeoutMs?: number; resultPath?: string }
  | { type: 'local'; actions: Array<Omit<LocalAction, 'value'> & { value?: JsonValue }> }
  | {
      type: 'request'
      url: string
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      query?: Record<string, JsonValue>
      headers?: Record<string, JsonValue>
      body?: JsonValue
      response?: 'json' | 'text'
      timeoutMs?: number
      resultPath?: string
    }
  | { type: 'callback'; name: string; args?: JsonValue; timeoutMs?: number; resultPath?: string }
  | { type: 'delay'; ms: number }
  | { type: 'emit'; name: string; detail?: JsonValue }
export interface EventBinding {
  actions: EventAction[]
  onSuccess?: EventAction[]
  onError?: EventAction[]
  loadingPath?: string
  errorPath?: string
  resultPath?: string
  debounceMs?: number
  concurrency?: 'drop' | 'latest'
}
export interface ComponentEvent {
  nodeId: string
  component: string
  event: ComponentEventName
  data: JsonValue
}
export interface EventReport extends ComponentEvent {
  phase: 'start' | 'success' | 'error' | 'cancelled' | 'emit'
  result?: JsonValue
  error?: string
  name?: string
  runId?: string
  scope?: 'event' | 'action' | 'request'
  actionType?: EventAction['type']
  branch?: 'actions' | 'onSuccess' | 'onError'
  step?: number
  durationMs?: number
  http?: { method: string; url: string; status?: number }
  stateChanges?: Array<{ path: string; before?: JsonValue; after?: JsonValue }>
}
export interface CallbackContext extends ComponentEvent {
  runId?: string
  signal: AbortSignal
  getState(): State
  setState(path: string, value: JsonValue): void
}
export type InteractionCallback = (
  args: JsonValue,
  context: CallbackContext,
) => unknown | Promise<unknown>
export interface InteractionHost {
  /** Run configured mount events once when the work opens; disable for thumbnails and snapshots. */
  autoStart?: boolean
  /** Opt-in workbench diagnostics; embedding hosts avoid per-action snapshots by default. */
  trace?: boolean
  /** Set false for editors and marketplace previews to isolate registered business handlers. */
  inheritRegistered?: boolean
  apis?: Record<string, import('../integrations/types').ApiDefinition>
  callbacks?: Record<string, InteractionCallback>
  /** Defaults to browser fetch; an explicit adapter can restrict destinations or provide credentials. */
  requests?: { allow: (url: URL, method: string) => boolean; fetch?: typeof fetch }
  onEvent?: (report: EventReport) => void
}
