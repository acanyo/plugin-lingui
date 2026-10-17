import { describe, expect, it } from 'vitest'
import { createInstance, examples, pureTheme } from '@lingui/renderer'
import { parseGeneratedDesign, validateGeneratedDesign } from '../ai-adapter/design-result'
import { templateInstance } from '../component-library/types'
import { projectSubmission } from '../marketplace/project-submission'

const definition = examples[0]!.create()
const theme = {
  ...pureTheme,
  id: 'user-style',
  name: '用户指定的直角紫色',
  radius: 0,
  colors: { ...pureTheme.colors, accent: '#7c3aed' },
}
describe('user-directed design styles', () => {
  it('accepts a separate theme without changing the document protocol', () => {
    const result = parseGeneratedDesign(
      '```json\n' + JSON.stringify({ document: definition, theme }) + '\n```',
    )
    expect(result.document).toEqual(definition)
    expect(result.theme).toEqual(theme)
    expect(result.document).not.toHaveProperty('theme')
    expect(createInstance(result.document, result.theme).theme.radius).toBe(0)
  })
  it('imports OpenUI without assigning a new theme', () => {
    expect(parseGeneratedDesign(JSON.stringify(definition))).toEqual({ document: definition })
  })
  it.each([
    { ...theme, radius: 99 },
    { ...theme, colors: { ...theme.colors, background: 'url(https://example.com)' } },
    { ...theme, css: 'body{}' },
    null,
  ])('rejects invalid or executable theme configuration', (theme) => {
    expect(() => parseGeneratedDesign(JSON.stringify({ document: definition, theme }))).toThrow()
  })
  it('rejects extra generation fields and unsafe property names', () => {
    expect(() =>
      parseGeneratedDesign(JSON.stringify({ document: definition, html: '<script/>' })),
    ).toThrow()
    expect(() => validateGeneratedDesign(null as never)).toThrow('格式无效')
  })
  it('retains the saved revision style in projects and submission drafts; legacy projects use the fallback', () => {
    const project = {
      id: 'project',
      name: '作品',
      category: '内容表达',
      description: '说明',
      revisions: [{ version: 1, createdAt: '2026-10-11T00:00:00Z', document: definition, theme }],
    }
    expect(templateInstance(project, pureTheme).theme).toEqual(theme)
    expect(projectSubmission(project).instance.theme).toEqual(theme)
    expect(
      templateInstance(
        { ...project, revisions: [{ version: 1, createdAt: '', document: definition }] },
        pureTheme,
      ).theme,
    ).toEqual(pureTheme)
  })
})
