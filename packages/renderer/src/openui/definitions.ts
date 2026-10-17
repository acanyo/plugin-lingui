import { createLibrary, defineComponent } from '@openuidev/lang-core'
import { z } from 'zod/v4'
import { componentNames, type ComponentName } from '../protocol/types'

/** Stable Lang identifiers; display names and existing component semantics stay independent. */
export const langName = (name: ComponentName): string => name.replace('LingUI.', 'LingUI_')
export const componentName = (name: string): ComponentName | undefined =>
  componentNames.find((value) => langName(value) === name)

/** Pure definitions are shared by validation, prompt generation and the Svelte runtime. */
export function defineLibrary(component: unknown = null) {
  return createLibrary({
    components: componentNames.map((name) => defineComponent({
      name: langName(name),
      description: `LingUI ${name}. config uses this component's strict catalog schema; content contains its referenced components.`,
      props: z.object({ config: z.json(), content: z.array(z.unknown()) }),
      component,
    })),
    root: 'Column',
  })
}
export const languageLibrary = defineLibrary()
