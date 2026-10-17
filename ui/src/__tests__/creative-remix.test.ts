import { describe, expect, it } from 'vitest'
import { createInstance } from '@lingui/renderer'
import { contractDocument } from './fixtures/response-contract'
import { createSubmission, exportSubmission, importSubmission } from '../marketplace/submission'
import { licenseProblem, remixSources, validateSources, type WorkSource } from '../remix/provenance'
import { projectSubmission } from '../marketplace/project-submission'
import { resumeSnapshot } from '../creation-history/types'
import type { MarketplaceWork } from '../marketplace/catalog'
const source: WorkSource = {
  workId: 'work-original',
  version: '1.0.0',
  title: '天气',
  author: '原作者',
  site: 'https://auth.lik.cc',
  license: 'MIT',
}
const work: MarketplaceWork = {
  id: source.workId,
  title: source.title,
  description: '作品',
  category: '接口',
  icon: 'layers',
  source: 'community',
  publisher: source.author,
  version: source.version,
  license: source.license,
  create: contractDocument,
}
const complete = () => ({
  ...createSubmission(createInstance(contractDocument()), [source]),
  description: '可改编天气组件',
  author: '改编者',
  category: '接口',
  license: 'MIT',
})
describe('portable remix attribution', () => {
  it('makes an independent source chain, saves it outside renderer snapshot, and round trips work packages and project revisions', () => {
    const before = JSON.stringify(work),
      provenance = remixSources(work, 'https://auth.lik.cc')
    expect(provenance).toEqual([source])
    expect(JSON.stringify(work)).toBe(before)
    const draft = complete(),
      pack = exportSubmission(draft),
      imported = importSubmission(JSON.stringify(pack))
    expect(imported.provenance).toEqual([source])
    expect(pack.instance).not.toHaveProperty('provenance')
    expect(pack).not.toHaveProperty('id')
    expect(pack).not.toHaveProperty('recordings')
    const project = {
      id: 'component-private',
      name: '改编天气',
      category: '接口',
      description: '说明',
      revisions: [
        {
          version: 1,
          createdAt: new Date().toISOString(),
          document: contractDocument(),
          provenance,
        },
      ],
    }
    expect(projectSubmission(project).provenance).toEqual(provenance)
    const restored = resumeSnapshot({
      messages: [],
      instruction: '',
      dirty: true,
      editing: false,
      instance: draft.instance,
      provenance,
    })
    expect(restored.provenance).toEqual([source])
  })
  it('does not invent permission or accept author-provided verification claims and unsafe source URLs', () => {
    expect(() => remixSources({ ...work, license: '保留所有权利' }, source.site)).toThrow(
      '未明确允许改编',
    )
    expect(() => validateSources([{ ...source, verified: true }])).toThrow('未知字段')
    expect(() => validateSources([{ ...source, site: 'javascript:alert(1)' }])).toThrow()
    expect(() => validateSources([{ ...source, site: 'https://user:pass@auth.lik.cc' }])).toThrow()
    expect(() => validateSources([{ ...source, version: 'latest' }])).toThrow()
  })
  it('enforces compatible licenses at publication while incomplete local drafts remain editable and old packages remain compatible', () => {
    expect(licenseProblem([{ ...source, license: 'GPL-3.0' }], 'MIT')).toContain('GPL-3.0')
    expect(licenseProblem([{ ...source, license: 'Apache-2.0' }], 'MIT')).toContain('Apache-2.0')
    const draft = complete()
    draft.provenance = [{ ...source, license: 'GPL-3.0' }]
    expect(() => exportSubmission(draft)).toThrow('GPL-3.0')
    draft.license = 'GPL-3.0'
    expect(exportSubmission(draft).provenance).toEqual(draft.provenance)
    const old = complete()
    delete old.provenance
    expect(importSubmission(JSON.stringify(exportSubmission(old)))).not.toHaveProperty('provenance')
  })
})
