import type { EventBinding } from '../../events/types'
import type { ApiDefinition } from '../../integrations/types'
import type { ComponentNode, JsonValue, State } from '../../protocol/types'
import { column, document, section, text } from '../builders'

export const apiExamplePrefix = '/__lingui_examples__/'

export function apiEvent(
  name: string,
  args: JsonValue = {},
  resultPath = '/response',
): EventBinding {
  return {
    actions: [{ type: 'api', name, args }],
    loadingPath: '/loading',
    errorPath: '/error',
    resultPath,
    concurrency: 'latest',
  }
}

export function apiButton(id: string, label: string, binding: EventBinding): ComponentNode[] {
  return [
    {
      id,
      component: 'Button',
      child: `${id}-label`,
      variant: 'primary',
      loading: { path: '/loading' },
      events: { click: binding },
    },
    text(`${id}-label`, label),
  ]
}

export function apiDocument(
  title: string,
  description: string,
  children: string[],
  nodes: ComponentNode[],
  apis: ApiDefinition[],
  state: State = {},
  startup?: EventBinding,
) {
  return {
    ...document(
      title,
      [
        {
          ...column('root', ['intro', ...children]),
          ...(startup ? { events: { mount: startup } } : {}),
        },
        section('intro', title, description, [], '接口应用 · 本地模拟数据'),
        ...nodes,
      ],
      { loading: false, error: '', response: { items: [] }, ...state },
    ),
    integrations: { apis, callbacks: [] },
  }
}
