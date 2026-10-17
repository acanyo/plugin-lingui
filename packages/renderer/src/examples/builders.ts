import { serializeSource } from '../openui/source'
import {
  type Action,
  type ComponentNode,
  type Dynamic,
  type Expression,
  type LinguiDocument,
  type LocalAction,
  type State,
} from '../protocol/types'
export const text = (id: string, value: Dynamic, variant = 'body'): ComponentNode => ({
  id,
  component: 'Text',
  text: value,
  variant,
})
export const column = (id: string, children: string[]): ComponentNode => ({
  id,
  component: 'Column',
  children,
})
export const row = (id: string, children: string[]): ComponentNode => ({
  id,
  component: 'Row',
  children,
})
export const computed = (expression: Expression): Dynamic => ({
  call: 'lingui.evaluate',
  args: { expression },
})
export const card = (id: string, child: string): ComponentNode => ({ id, component: 'Card', child })
export const section = (
  id: string,
  title: string,
  description: string,
  children: string[],
  label?: string,
): ComponentNode => ({
  id,
  component: 'LingUI.Section',
  title,
  description,
  children,
  ...(label ? { label } : {}),
})
export const grid = (id: string, children: string[], maxColumns: 2 | 3 | 4 = 2): ComponentNode => ({
  id,
  component: 'LingUI.Grid',
  children,
  maxColumns,
})
export const softCard = (id: string, child: string): ComponentNode => ({
  ...card(id, child),
  variant: 'soft',
})
export const badge = (id: string, value: string, tone = 'info'): ComponentNode => ({
  id,
  component: 'LingUI.Badge',
  text: value,
  tone,
})
export const metric = (
  id: string,
  label: string,
  value: Dynamic,
  description?: string,
): ComponentNode => ({
  id,
  component: 'LingUI.Metric',
  label,
  value,
  ...(description ? { description } : {}),
})
export const dispatch = (...actions: LocalAction[]): Action => ({
  functionCall: { call: 'lingui.dispatch', args: { actions } },
})
export const button = (
  id: string,
  child: string,
  actions: LocalAction[],
  variant = 'secondary',
): ComponentNode => ({ id, component: 'Button', child, variant, action: dispatch(...actions) })
export function document(title: string, nodes: ComponentNode[], state: State = {}): LinguiDocument {
  return {
    schemaVersion: 'lingui.document/2',
    title,
    parameters: [],
    source: serializeSource(nodes),
    state,
  }
}
