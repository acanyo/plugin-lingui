import type { TemplateRecord } from '../component-library/types'
import { workInstance, type MarketplaceWork } from '../marketplace/catalog'
import { marketSite } from '../marketplace/market-service'
import { remixSources } from '../remix/provenance'
import { cloneJson } from '../shared/clone'

export function downloadedProject(work: MarketplaceWork, projects: TemplateRecord[]) {
  return projects.find((project) => {
    const source = project.revisions.at(-1)?.provenance?.[0]
    return (
      source?.site === marketSite && source.workId === work.id && source.version === work.version
    )
  })
}

export function marketProject(work: MarketplaceWork): TemplateRecord {
  if (work.kind === 'theme') throw new Error('请从应用市场选择组件作品')
  const instance = workInstance(work)
  // Project parameters use their defaults. Retain the market instance's configured values.
  const document = cloneJson(instance.document)
  for (const parameter of document.parameters) {
    const value = instance.parameters[parameter.key]
    if (value !== undefined) parameter.default = value
  }
  return {
    id: `component-${crypto.randomUUID()}`,
    name: work.title,
    category: work.category,
    description: work.description,
    revisions: [
      {
        version: 1,
        createdAt: new Date().toISOString(),
        document,
        theme: cloneJson(instance.theme),
        provenance: remixSources(work, marketSite),
      },
    ],
  }
}
