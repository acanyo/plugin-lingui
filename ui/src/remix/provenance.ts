import type { MarketplaceWork } from '../marketplace/catalog'
export interface WorkSource {
  workId: string
  version: string
  title: string
  author: string
  site: string
  license: string
}
export function validateSources(value: unknown): WorkSource[] {
  if (!Array.isArray(value) || value.length > 6) throw new Error('改编来源记录无效')
  return value.map((source) => {
    if (
      !source ||
      typeof source !== 'object' ||
      Object.keys(source).some(
        (key) => !['workId', 'version', 'title', 'author', 'site', 'license'].includes(key),
      )
    )
      throw new Error('改编来源包含未知字段')
    const result: Record<string, string> = {}
    for (const [key, max] of Object.entries({
      workId: 100,
      version: 30,
      title: 120,
      author: 80,
      site: 200,
      license: 40,
    })) {
      const text = source[key]
      if (typeof text !== 'string' || !text.trim() || text.length > max)
        throw new Error('改编来源字段无效')
      result[key] = text.trim()
    }
    const url = new URL(result.site!)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('来源站点需要 HTTPS 站点地址')
    if (!/^work-[\w-]+$/.test(result.workId!) || !/^\d+\.\d+\.\d+$/.test(result.version!))
      throw new Error('原作标识或版本无效')
    return result as unknown as WorkSource
  })
}
export function remixSources(work: MarketplaceWork, site: string): WorkSource[] {
  if (!['MIT', 'Apache-2.0', 'GPL-3.0'].includes(work.license))
    throw new Error('此作品未明确允许改编，请先向原作者取得可用许可证')
  return validateSources([
    {
      workId: work.id,
      version: work.version,
      title: work.title,
      author: work.publisher,
      site,
      license: work.license,
    },
    ...(work.provenance ?? []),
  ])
}
export function licenseProblem(sources: WorkSource[], license: string): string {
  for (const source of sources) {
    if (!['MIT', 'Apache-2.0', 'GPL-3.0'].includes(source.license))
      return '原作缺少允许改编的许可证，请先处理原作者授权'
    if (source.license === 'GPL-3.0' && license !== 'GPL-3.0')
      return '原作使用 GPL-3.0，改编投稿也需要选择 GPL-3.0'
    if (source.license === 'Apache-2.0' && !['Apache-2.0', 'GPL-3.0'].includes(license))
      return 'Apache-2.0 原作的改编请选择 Apache-2.0 或 GPL-3.0，并保留原署名与声明'
  }
  return ''
}
