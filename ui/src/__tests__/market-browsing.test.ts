import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { examples } from '@lingui/renderer'
import MarketplaceView from '../marketplace/MarketplaceView.vue'
import { marketService } from '../marketplace/market-service'
import { workInstance, type MarketplaceWork } from '../marketplace/catalog'
import { themeSubmission } from '../marketplace/theme-submission'

let view: VueWrapper | undefined
afterEach(() => {
  view?.unmount()
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.replaceChildren()
})
function publicWork(id: string): MarketplaceWork {
  return {
    ...examples.find((example) => example.id === id)!,
    id: `work-${id}`,
    source: 'community',
    publisher: '市场作者',
    license: 'MIT',
    version: '1.0.0',
  }
}
function mockMarket(ids: string[]) {
  const works = ids.map(publicWork)
  vi.spyOn(marketService, 'get').mockImplementation(async (id) =>
    works.find((work) => work.id === id)!,
  )
  return vi.spyOn(marketService, 'list').mockImplementation(async (_page, query = '') => {
    const filtered = works.filter((work) => `${work.title} ${work.description}`.includes(query))
    return {
      items: filtered.map((work) => ({ name: work.id, title: work.title, author: work.publisher })),
      total: filtered.length,
      componentTotal: filtered.length,
      themeTotal: 0,
    }
  })
}
async function render() {
  view = mount(MarketplaceView, { attachTo: document.body })
  await flushPromises()
  return view
}
async function press(label: string) {
  await view!
    .findAll('button')
    .find((button) => button.text().trim() === label)!
    .trigger('click')
  await flushPromises()
}
function previewRoot() {
  return document.querySelector('.lu-detail-preview .lingui-renderer-host')!.shadowRoot!
}

describe('market browsing', () => {
  it('uses a market theme as styling rather than replacing the active component document', async () => {
    const instance = themeSubmission(workInstance(publicWork('quiz')).theme).instance
    const work: MarketplaceWork = {
      ...publicWork('quiz'),
      id: 'theme-market',
      title: '社区主题',
      kind: 'theme',
      instance,
    }
    vi.spyOn(marketService, 'list').mockResolvedValue({
      items: [],
      total: 0,
      componentTotal: 0,
      themeTotal: 1,
    })
    vi.mocked(marketService.list).mockImplementation(async (_page, _query, kind) => ({
      items: kind === 'theme' ? [{ name: work.id, title: work.title }] : [],
      total: kind === 'theme' ? 1 : 0,
      componentTotal: 0,
      themeTotal: 1,
    }))
    vi.spyOn(marketService, 'get').mockResolvedValue(work)
    const market = await render()
    await market.get('[role=tab][data-kind=theme]').trigger('click')
    await flushPromises()
    await market.get('[aria-label="使用社区主题"]').trigger('click')
    await flushPromises()
    expect(market.emitted('theme')).toEqual([[instance.theme]])
    expect(market.emitted('use')).toBeUndefined()
  })
  it('loads the managed market directly and preserves cards, preview state isolation and keyboard focus', async () => {
    const list = mockMarket(['flashcard', 'budget'])
    const market = await render()
    expect(list).toHaveBeenCalledExactlyOnceWith(1, '', 'component')
    expect(market.find('[aria-label="市场来源"]').exists()).toBe(false)
    expect(market.text()).not.toContain('内置作品')
    expect(market.findAll('.lu-builtin-card')).toHaveLength(2)
    const trigger = market.get<HTMLButtonElement>('[aria-label="预览知识闪卡"]')
    trigger.element.focus()
    await trigger.trigger('click')
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(market.findAll('.lu-builtin-card')).toHaveLength(2)
    previewRoot().querySelector<HTMLButtonElement>('button')!.click()
    await flushPromises()
    expect(previewRoot().textContent).toContain('每个请求都是独立的')
    await press('关闭预览')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
    expect(market.findAll('.lu-builtin-card')).toHaveLength(2)
    await trigger.trigger('click')
    await flushPromises()
    expect(previewRoot().textContent).not.toContain('每个请求都是独立的')
    expect(market.emitted('use')).toBeUndefined()
  })

  it('searches the managed market, retains the search after preview, and passes a complete editing snapshot', async () => {
    vi.useFakeTimers()
    const list = mockMarket(['flashcard', 'budget'])
    const market = await render()
    await market.get('[aria-label="搜索市场作品"]').setValue('  预算  ')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, '预算', 'component')
    expect(market.findAll('.lu-builtin-card')).toHaveLength(1)
    await market.get('[aria-label="预览出行预算"]').trigger('click')
    await flushPromises()
    expect(previewRoot().textContent).toContain('预计总花费')
    await press('关闭预览')
    expect(market.get<HTMLInputElement>('[aria-label="搜索市场作品"]').element.value).toBe(
      '  预算  ',
    )
    expect(market.findAll('.lu-builtin-card')).toHaveLength(1)
    await market.get('[aria-label="预览出行预算"]').trigger('click')
    await flushPromises()
    await press('基于此作品创作')
    expect(market.emitted('use')!.at(-1)).toEqual([
      workInstance(publicWork('budget')),
      [
        {
          workId: 'work-budget',
          version: '1.0.0',
          title: '出行预算',
          author: '市场作者',
          site: 'https://auth.lik.cc',
          license: 'MIT',
        },
      ],
    ])
  })
})
