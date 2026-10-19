import { createInput } from '@formkit/vue'
import FormKitProjectSelect from './FormKitProjectSelect.vue'

export { default as LinguiProjectSelect } from './LinguiProjectSelect.vue'
export { projectSelectionClientKey, createProjectSelectionClient } from './client'
export type { ProjectSelectionClient, ProjectOptionsQuery } from './client'

export const linguiProjectSelect = createInput(
  FormKitProjectSelect,
  { props: ['category', 'publicOnly', 'clearable', 'placeholder', 'pageSize', 'showPreview'] },
  { label: { attrs: { for: '$id + "-selection"' } } },
)
