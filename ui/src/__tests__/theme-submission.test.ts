import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { pureTheme, validateTheme } from '@lingui/renderer'
import { copyMarketTheme, themeSubmission } from '../marketplace/theme-submission'
import { exportSubmission, importSubmission } from '../marketplace/submission'
import SubmissionThemeDialog from '../marketplace/SubmissionThemeDialog.vue'
import { repositoryKey } from '../services/repository'
import { createLocalRepository } from '../dev/local-repository'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
const theme = {
  ...pureTheme,
  id: 'my-theme',
  name: '我的绿色主题',
  colors: { ...pureTheme.colors, accent: '#16753f' },
  radius: 4,
}
describe('theme publication', () => {
  it('exports a complete, independent theme and font snapshot with an interactive specimen', () => {
    const source = {
      ...theme,
      customFont: {
        id: 'my-font',
        name: '我的字体',
        faces: [
          {
            url: 'https://example.com/font.woff2',
            format: 'woff2' as const,
            weight: '400',
            style: 'normal' as const,
          },
        ],
      },
    }
    const draft = {
      ...themeSubmission(source, '作者'),
      description: '绿色主题说明',
      license: 'MIT',
    }
    const exported = exportSubmission(draft)
    expect(exported.kind).toBe('theme')
    expect(exported.instance.theme).toEqual(source)
    expect(importSubmission(JSON.stringify(exported)).instance.theme).toEqual(source)
    draft.instance.theme.customFont!.name = '修改副本'
    expect(source.customFont.name).toBe('我的字体')
    const copied = copyMarketTheme(source)
    expect(copied.id).not.toBe(source.id)
    expect(validateTheme(copied).colors.accent).toBe('#16753f')
    expect(copied.customFont).not.toBe(source.customFont)
  })
  it('rejects an unknown publication kind without changing legacy component packages', () => {
    const draft = {
      ...themeSubmission(theme),
      description: '主题说明',
      author: '作者',
      license: 'MIT',
    }
    expect(() => exportSubmission({ ...draft, kind: 'script' } as never)).toThrow('类型')
    const { kind: _kind, ...legacy } = exportSubmission(draft)
    expect(importSubmission(JSON.stringify(legacy))).not.toHaveProperty('kind')
  })
  it('selects only saved custom themes, searches, and makes a draft without writing', async () => {
    const repository = createLocalRepository()
    vi.spyOn(repository, 'listThemes').mockResolvedValue([pureTheme, theme])
    const save = vi.spyOn(repository, 'saveTheme')
    view = mount(SubmissionThemeDialog, {
      props: { author: '投稿作者' },
      global: { provide: { [repositoryKey as symbol]: repository } },
    })
    await flushPromises()
    expect(view.findAll('.lu-project-picker-item')).toHaveLength(1)
    await view.get('[aria-label="搜索投稿主题"]').setValue('不存在')
    expect(view.text()).toContain('没有匹配的主题')
    await view.get('[aria-label="搜索投稿主题"]').setValue('绿色')
    await view.get('.lu-project-picker-item').trigger('click')
    expect(view.find('.lu-project-picker-preview .lingui-renderer-host').exists()).toBe(true)
    await view
      .findAll('button')
      .find((button) => button.text() === '下一步：填写主题说明')!
      .trigger('click')
    expect(view.emitted('selected')?.[0]?.[0]).toMatchObject({
      kind: 'theme',
      title: theme.name,
      author: '投稿作者',
      instance: { theme },
    })
    expect(save).not.toHaveBeenCalled()
  })
  it('handles a loading failure and gives an empty-state route to the theme studio after retry', async () => {
    const repository = createLocalRepository()
    vi.spyOn(repository, 'listThemes')
      .mockRejectedValueOnce(new Error('主题读取失败'))
      .mockResolvedValueOnce([pureTheme])
    view = mount(SubmissionThemeDialog, {
      global: { provide: { [repositoryKey as symbol]: repository } },
    })
    await flushPromises()
    expect(view.get('[role="alert"]').text()).toContain('主题读取失败')
    await view
      .findAll('button')
      .find((button) => button.text() === '重新加载')!
      .trigger('click')
    await flushPromises()
    await view
      .findAll('button')
      .find((button) => button.text() === '前往主题工作室')!
      .trigger('click')
    expect(view.emitted('themes')).toHaveLength(1)
  })
})
