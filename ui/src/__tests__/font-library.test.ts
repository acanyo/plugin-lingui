import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { axiosInstance } from '@halo-dev/api-client'
import {
  fontFamilyName,
  fontUrl,
  pureTheme,
  registerFont,
  tokenStyle,
  validateFontFamily,
  validateTheme,
  validFontWeight,
  validUnicodeRange,
  type FontFamilyDefinition,
} from '@lingui/renderer'
import ThemeControls from '../theme-studio/ThemeControls.vue'
import ThemeStudio from '../theme-studio/ThemeStudio.vue'
import FontManagerView from '../font-library/FontManagerView.vue'
import { createHaloFontRepository } from '../services/halo-font-repository'
import { createHaloRepository } from '../services/halo-repository'
import { createLocalRepository } from '../dev/local-repository'
import { repositoryKey } from '../services/repository'
import { fetchFontCss, MAX_CSS_BYTES } from '../font-library/css-import'
import { exportFontCss } from '../font-library/css-export'
import { externalAiInstructions } from '../mcp/external-ai'

const font: FontFamilyDefinition = {
  id: 'font-test',
  name: '测试分包字体',
  faces: [
    {
      url: 'https://fonts.example/latin.woff2',
      format: 'woff2',
      weight: '100 900',
      style: 'normal',
      unicodeRange: 'U+0000-00FF',
    },
    {
      url: 'https://fonts.example/han.woff2',
      format: 'woff2',
      weight: '400',
      style: 'italic',
      unicodeRange: 'U+4E??, U+5000-9FFF',
    },
  ],
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('font manifests and lazy registration', () => {
  it('preserves shard descriptors in theme snapshots and adds a system fallback', () => {
    const snapshot = validateTheme({ ...pureTheme, customFont: font })
    expect(snapshot.customFont).toEqual(font)
    expect(snapshot.customFont).not.toBe(font)
    expect(tokenStyle(snapshot)['--lingui-font']).toContain(
      `"${fontFamilyName(font)}", -apple-system`,
    )
    expect(fontFamilyName({ ...font, name: '重命名', id: 'other' })).toBe(fontFamilyName(font))
  })
  it.each(['0', '1001', '900 100', '400 1001', 'normal', '1 2 3'])(
    'rejects invalid weight %s',
    (weight) => {
      expect(validFontWeight(weight)).toBe(false)
      expect(() => validateFontFamily({ ...font, faces: [{ ...font.faces[0], weight }] })).toThrow()
    },
  )
  it.each(['1', '400', '100 900', '1000'])('accepts bounded weight %s', (weight) =>
    expect(validFontWeight(weight)).toBe(true),
  )
  it.each(['U+FFFFFF', 'U+FFFF-0000', 'U+??????', 'U+4?A?', 'U+0000,', 'U+110000'])(
    'rejects invalid unicode range %s',
    (range) => expect(validUnicodeRange(range)).toBe(false),
  )
  it.each(['U+0-10FFFF', 'U+4E??', 'u+0000-00ff, U+4E00'])('accepts unicode range %s', (range) =>
    expect(validUnicodeRange(range)).toBe(true),
  )
  it.each([
    'data:font/woff2;base64,x',
    'blob:https://example.com/x',
    '/font.woff2',
    '//example.com/font.woff2',
    'http://example.com/font.woff2',
    'https://u:p@example.com/font.woff2',
    'https://example.com/f.woff2#x',
  ])('rejects font source %s', (url) => expect(fontUrl(url)).toBeUndefined())
  it('rejects unknown fields, unsafe JSON and oversized manifests', () => {
    expect(() => validateFontFamily({ ...font, css: 'body{}' })).toThrow()
    expect(() => validateFontFamily({ ...font, name: ' ' })).toThrow()
    expect(() => validateFontFamily({ ...font, faces: [] })).toThrow()
    expect(() => validateFontFamily({ ...font, faces: Array(513).fill(font.faces[0]) })).toThrow()
    expect(() =>
      validateFontFamily({
        ...font,
        faces: Array(512).fill({
          ...font.faces[0],
          url: `https://example.com/${'a'.repeat(300)}.woff2`,
        }),
      }),
    ).toThrow(/192 KiB/)
  })
  it('registers unloaded faces once per document and releases after the last consumer', () => {
    const added: unknown[] = [],
      removed: unknown[] = [],
      load = vi.fn()
    class Face {
      load = load
      constructor(
        public family: string,
        public source: string,
        public descriptors: unknown,
      ) {}
    }
    vi.stubGlobal('FontFace', Face)
    const doc = {
      fonts: {
        add: (face: unknown) => added.push(face),
        delete: (face: unknown) => removed.push(face),
      },
    } as unknown as Document
    const first = registerFont(font, doc),
      second = registerFont(font, doc)
    expect(added).toHaveLength(2)
    expect(load).not.toHaveBeenCalled()
    expect(added[0]).toMatchObject({
      descriptors: { weight: '100 900', display: 'swap', unicodeRange: 'U+0000-00FF' },
    })
    first()
    first()
    expect(removed).toHaveLength(0)
    second()
    expect(removed).toEqual(added)
    registerFont(font, doc)()
    expect(added).toHaveLength(4)
  })
  it('does not leak partial registrations if a descriptor is unsupported', () => {
    let count = 0
    vi.stubGlobal(
      'FontFace',
      class {
        constructor() {
          if (++count === 2) throw new Error('unsupported')
        }
      },
    )
    const add = vi.fn(),
      doc = { fonts: { add } } as unknown as Document
    expect(() => registerFont(font, doc)).toThrow()
    expect(add).not.toHaveBeenCalled()
  })
})

describe('CSS download and Halo persistence', () => {
  it('exports portable CSS with absolute shard URLs, weights and ranges', () => {
    const css = exportFontCss(font)
    expect(css.match(/@font-face/g)).toHaveLength(2)
    expect(css).toContain('font-weight: 100 900;')
    expect(css).toContain('unicode-range: U+4E??, U+5000-9FFF;')
    expect(css).toContain('url("https://fonts.example/han.woff2")')
    expect(exportFontCss({ ...font, name: 'Test"\n} body{}' })).toContain(
      'font-family: "Test\\"\\a } body{}";',
    )
  })
  it('omits credentials and uses the final CSS URL for relative shards', async () => {
    const response = new Response('@font-face{}')
    Object.defineProperty(response, 'url', { value: 'https://cdn.example/fonts/style.css' })
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    expect(await fetchFontCss('https://example.com/font.css', controller.signal)).toEqual({
      text: '@font-face{}',
      sourceUrl: response.url,
    })
    expect(fetch).toHaveBeenCalledWith('https://example.com/font.css', {
      credentials: 'omit',
      mode: 'cors',
      signal: controller.signal,
    })
  })
  it('bounds streamed CSS before parsing and reports HTTP errors', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(new Uint8Array(MAX_CSS_BYTES + 1)))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchFontCss('https://example.com/font.css')).rejects.toThrow('HTTP 404')
    await expect(fetchFontCss('https://example.com/font.css')).rejects.toThrow('1 MiB')
  })
  it('saves and updates validated manifests with resource versions', async () => {
    const resource = {
      apiVersion: 'lingui.acanyo.com/v1alpha1',
      kind: 'FontFamily',
      metadata: { name: font.id, version: 3 },
      spec: { displayName: font.name, manifest: JSON.stringify(font) },
    }
    const request = vi.spyOn(axiosInstance, 'request').mockResolvedValue({ data: resource })
    const repo = createHaloFontRepository()
    expect((await repo.saveFont({ definition: font })).definition).toEqual(font)
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/apis/lingui.acanyo.com/v1alpha1/fontfamilies',
      }),
    )
    await repo.saveFont({ definition: font, versionToken: 3 })
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: `/apis/lingui.acanyo.com/v1alpha1/fontfamilies/${font.id}`,
      }),
    )
    await repo.deleteFont(font.id)
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'DELETE' }))
  })
  it('keeps the author font after AI styling without sending shard URLs to the model', async () => {
    const request = vi
      .spyOn(axiosInstance, 'request')
      .mockResolvedValue({ data: { content: JSON.stringify({ ...pureTheme, radius: 0 }) } })
    const theme = { ...pureTheme, customFont: font }
    const result = await createHaloRepository().generateTheme('优化配色', theme)
    expect(result.customFont).toEqual(font)
    expect(result.radius).toBe(0)
    expect(JSON.stringify(request.mock.calls)).not.toContain('latin.woff2')
    expect(
      externalAiInstructions({
        endpoint: 'https://halo.example.com/mcp',
        kind: 'theme',
        instruction: '优化配色',
        theme,
      }),
    ).not.toContain('latin.woff2')
  })
})

describe('theme font selection and management', () => {
  it('preserves the selected font when importing an external AI theme', async () => {
    const view = mount(ThemeStudio, {
      props: { themes: [pureTheme] },
      global: {
        provide: {
          [repositoryKey as symbol]: {
            ...createLocalRepository(),
            listFonts: async () => [{ definition: font }],
          },
        },
      },
    })
    await flushPromises()
    await view.get('.lu-theme-font-trigger').trigger('click')
    await view.get('[data-font-key="custom:font-test"]').trigger('click')
    await view
      .findAll('button')
      .find((item) => item.text() === '导入 AI 主题')!
      .trigger('click')
    await view
      .get('textarea[aria-label="主题 JSON"]')
      .setValue(JSON.stringify({ ...pureTheme, radius: 0 }))
    await view
      .findAll('button')
      .find((item) => item.text() === '校验并预览')!
      .trigger('click')
    await flushPromises()
    await view
      .findAll('button')
      .find((item) => item.text() === '保存为我的主题')!
      .trigger('click')
    expect(view.emitted('save')!.at(-1)![0]).toMatchObject({ customFont: font, radius: 0 })
    view.unmount()
  })
  it('switches from a managed font to a valid built-in theme without an undefined JSON key', async () => {
    const view = mount(ThemeControls, {
      props: {
        modelValue: { ...pureTheme, customFont: font },
        fonts: [font],
        'onUpdate:modelValue': (value) => view.setProps({ modelValue: value }),
      },
    })
    await view.get('.lu-theme-font-trigger').trigger('click')
    await view.get('[data-font-key="builtin:serif"]').trigger('click')
    const value = view.emitted('update:modelValue')!.at(-1)![0]
    expect(value).not.toHaveProperty('customFont')
    expect(validateTheme(value).font).toBe('serif')
    view.unmount()
  })
  it('offers saved fonts and renames without changing their manifest sources', async () => {
    const saveFont = vi.fn(async (value) => ({ ...value, versionToken: 2 }))
    const view = mount(FontManagerView, {
      props: { selection: true },
      global: {
        provide: {
          [repositoryKey as symbol]: {
            ...createLocalRepository(),
            listFonts: async () => [{ definition: font, versionToken: 1 }],
            saveFont,
          },
        },
      },
    })
    await flushPromises()
    await view
      .findAll('button')
      .find((item) => item.text() === '使用此字体')!
      .trigger('click')
    expect(view.emitted('select')![0]![0]).toEqual(font)
    await view
      .findAll('button')
      .find((item) => item.text() === '重命名')!
      .trigger('click')
    await view.get('.lu-font-rename input').setValue('新的名字')
    await view.get('.lu-font-rename').trigger('submit')
    await flushPromises()
    expect(saveFont).toHaveBeenCalledWith({
      definition: { ...font, name: '新的名字' },
      versionToken: 1,
    })
    expect(view.text()).toContain('新的名字')
    view.unmount()
  })
})
