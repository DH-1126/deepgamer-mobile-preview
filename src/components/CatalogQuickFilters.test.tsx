import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CatalogQuickFilters, createCatalogQuickFilterDraft, resetCatalogQuickFilterDraft, type CatalogQuickFilterPanel } from './CatalogQuickFilters'

const callbacks = () => ({
  onClose: vi.fn(),
  onApplySort: vi.fn(),
  onApplyServer: vi.fn(),
  onApplyPrice: vi.fn(),
})

function renderPanel(panel: CatalogQuickFilterPanel, minPrice = '', maxPrice = '') {
  const handlers = callbacks()
  const html = renderToStaticMarkup(<CatalogQuickFilters panel={panel} anchorRef={createRef<HTMLElement>()} sort="listed_at_desc" platforms={['安卓QQ', 'iOS QQ']} minPrice={minPrice} maxPrice={maxPrice} {...handlers} />)
  return { html, handlers }
}

describe('CatalogQuickFilters', () => {
  it.each(['sort', 'server', 'price'] as const)('uses the shared two-action panel structure for %s', (panel) => {
    const { html, handlers } = renderPanel(panel)
    expect(html).toContain('role="dialog"')
    expect(html.match(/data-ui="Button"/g)).toHaveLength(2)
    expect(html).toContain('dg-button--outline dg-button--md')
    expect(html).toContain('dg-button--primary dg-button--md')
    expect(html).toContain('重置')
    expect(html).toContain('确定')
    expect(handlers.onApplySort).not.toHaveBeenCalled()
    expect(handlers.onApplyServer).not.toHaveBeenCalled()
    expect(handlers.onApplyPrice).not.toHaveBeenCalled()
  })

  it('keeps sort choices in the required two-row order and uses shared choice chips', () => {
    const { html } = renderPanel('sort')
    const labels = ['综合', '最新', '价格升序', '价格降序']
    expect(html.match(/data-ui="ChoiceChip"/g)).toHaveLength(4)
    labels.slice(1).forEach((label, index) => expect(html.indexOf(labels[index])).toBeLessThan(html.indexOf(label)))
    expect(html).toContain('aria-pressed="true"')
  })

  it('renders the shared range error and disables confirmation for an invalid price range', () => {
    const { html } = renderPanel('price', '900', '100')
    expect(html).toContain('data-ui="RangeField"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('最低值不能高于最高值')
    expect(html).toMatch(/dg-button--primary[^>]*disabled/)
  })

  it('resets only draft values and leaves the applied snapshot unchanged until confirmation', () => {
    const applied = createCatalogQuickFilterDraft('price_desc', ['安卓QQ', 'iOS QQ'], '530', '850')
    const resetSort = resetCatalogQuickFilterDraft('sort', applied)
    const resetServer = resetCatalogQuickFilterDraft('server', applied)
    const resetPrice = resetCatalogQuickFilterDraft('price', applied)

    expect(applied).toEqual({ sort: 'price_desc', server: 'qq', price: { min: '530', max: '850', preset: '530-850' } })
    expect(resetSort.sort).toBe('default')
    expect(resetServer.server).toBe('all')
    expect(resetPrice.price).toEqual({ min: '', max: '', preset: null })
  })
})
