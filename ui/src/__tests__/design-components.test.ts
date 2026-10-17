import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  createInstance,
  examples,
  resolveDocument,
  mountRenderer,
  validateDocument,
  type ComponentNode,
  type RendererHandle,
} from '@lingui/renderer'
import { column, document as definition } from '../../../packages/renderer/src/examples/builders'
import { addNode, createBlankDocument } from '../component-studio/document-editor'
import DesignProperties from '../component-studio/DesignProperties.vue'
import { staticPreview } from './helpers/static-preview'
const handles: RendererHandle[] = []
let view: VueWrapper | undefined
afterEach(async () => {
  view?.unmount()
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()))
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function render(nodes: ComponentNode[]) {
  const host = document.createElement('div')
  document.body.append(host)
  handles.push(mountRenderer(host, createInstance(definition('示例', nodes))))
  return host.shadowRoot!
}
describe('new design components', () => {
  it('renders code as text, copies the exact source and handles unavailable clipboard', async () => {
    const code = '<script>alert("unsafe")</script>\nconst count = 2;'
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    try {
      const root = render([
        { id: 'root', component: 'LingUI.CodeBlock', code, language: 'javascript' },
      ])
      expect(root.querySelector('code')!.textContent).toBe(code)
      expect(root.querySelector('script')).toBeNull()
      root.querySelector('button')!.click()
      await flushPromises()
      expect(writeText).toHaveBeenCalledExactlyOnceWith(code)
      expect(root.querySelector('[role=status]')!.textContent).toBe('已复制')
      writeText.mockRejectedValueOnce(new Error('unavailable'))
      root.querySelector('button')!.click()
      await flushPromises()
      expect(root.querySelector('[role=status]')!.textContent).toContain('请选择代码复制')
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('renders chart values accessibly and handles all-zero data without invalid widths', () => {
    const root = render([
      {
        id: 'root',
        component: 'LingUI.BarChart',
        label: '耗时',
        unit: 'ms',
        data: [
          { label: '甲', value: 0 },
          { label: '乙', value: 0 },
        ],
      },
    ])
    expect(root.querySelectorAll('li')).toHaveLength(2)
    expect(root.textContent).toContain('甲')
    expect(root.textContent).toContain('0')
    expect(
      [...root.querySelectorAll<HTMLElement>('.lg-chart-bar')].map((bar) => bar.style.width),
    ).toEqual(['0%', '0%'])
  })
  it.each([-1, Infinity, 1e13])('rejects invalid chart data %s', (value) => {
    expect(() =>
      validateDocument(
        definition('图表', [
          {
            id: 'root',
            component: 'LingUI.BarChart',
            label: '图表',
            data: [{ label: '数据', value }],
          },
        ]),
      ),
    ).toThrow()
  })
  it('keeps chapter and grid references subject to cycle validation', () => {
    expect(() =>
      validateDocument(
        definition('章节', [
          { id: 'root', component: 'LingUI.Section', title: '标题', children: ['grid'] },
          { id: 'grid', component: 'LingUI.Grid', children: ['root'] },
        ]),
      ),
    ).toThrow()
  })
  it.each([
    'LingUI.Section',
    'LingUI.Grid',
    'LingUI.CodeBlock',
    'LingUI.KeyValue',
    'LingUI.BarChart',
  ] as const)('creates editable %s with valid defaults', (type) => {
    const added = addNode(createBlankDocument(), 'root', type)
    expect(resolveDocument(validateDocument(added.document)).nodes[added.id]!.component).toBe(type)
    if (type === 'LingUI.Section' || type === 'LingUI.Grid')
      expect(() =>
        validateDocument(addNode(added.document, added.id, 'Text').document),
      ).not.toThrow()
  })
  it.each(['spring-flux', 'code-guide', 'benchmark', 'feature-overview'])(
    'preserves readable %s static preview',
    async (id) => {
      const fallback = await staticPreview(
        createInstance(examples.find((example) => example.id === id)!.create()),
      )
      expect(fallback.querySelector('h2')).not.toBeNull()
      if (id === 'code-guide')
        expect(fallback.querySelector('pre code')!.textContent).toContain('response.ok')
      if (id === 'spring-flux') expect(fallback.querySelectorAll('dt')).toHaveLength(4)
      if (id === 'benchmark') expect(fallback.textContent).toContain('420')
      expect(fallback.querySelector('script')).toBeNull()
    },
  )
  it('updates chart data through the manual inspector with schema validation', async () => {
    const node: ComponentNode = {
      id: 'root',
      component: 'LingUI.BarChart',
      label: '图表',
      data: [{ label: '甲', value: 1 }],
    }
    view = mount(DesignProperties, { props: { node } })
    await view.get('input[type=number]').setValue('250')
    await view.get('input[type=number]').trigger('change')
    const next = view.emitted('update')!.at(-1)![0] as ComponentNode
    expect(next.data![0]!.value).toBe(250)
    expect(() => validateDocument(definition('图表', [next]))).not.toThrow()
  })
})
