import type { WorkSource } from '../remix/provenance'
import type { SharedDemo } from '../interaction-recordings/shared-demo'
import {
  createInstance,
  validateInstance,
  examples,
  type ComponentInstance,
  type LinguiDocument,
} from '@lingui/renderer'

/** A marketplace listing is separate from an editable project and an article instance. */
export interface MarketplaceWork {
  kind?: 'component' | 'theme'
  id: string
  title: string
  description: string
  category: string
  icon: string
  source: 'builtin' | 'community'
  publisher: string
  license: string
  version?: string
  provenance?: WorkSource[]
  demos?: SharedDemo[]
  instance?: ComponentInstance
  create: () => LinguiDocument
}
export interface MarketplaceCatalog {
  list(): readonly MarketplaceWork[]
}
const featured = [
  'lesson-planner',
  'media-notebook',
  'spring-flux',
  'code-guide',
  'benchmark',
  'feature-overview',
  'quiz',
  'checklist',
  'comparison',
  'architecture',
  'budget',
  'steps',
]
export const builtinCatalog: MarketplaceCatalog = {
  list: () =>
    [...examples]
      .sort(
        (a, b) =>
          (featured.indexOf(a.id) < 0 ? 99 : featured.indexOf(a.id)) -
          (featured.indexOf(b.id) < 0 ? 99 : featured.indexOf(b.id)),
      )
      .map((example) => ({
        ...example,
        source: 'builtin',
        publisher: '灵构 UI',
        license: 'GPL-3.0',
      })),
}

export function workInstance(work: MarketplaceWork): ComponentInstance {
  return work.instance ? validateInstance(work.instance) : createInstance(work.create())
}
