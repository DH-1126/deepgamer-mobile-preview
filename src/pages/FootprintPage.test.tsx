import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FootprintPage, footprintTimeOptions } from './FootprintPage'
import { createFootprintItems, defaultFootprintFilters, filterFootprintItems, formatFootprintTime } from '../components/footprintModel'

const renderPage = () => renderToStaticMarkup(<StaticRouter location="/footprints"><FootprintPage /></StaticRouter>)

describe('footprint page design structure', () => {
  afterEach(() => vi.useRealTimers())

  it('includes search and all three filter triggers, without the obsolete game pills', () => {
    const html = renderPage()
    expect(html).toContain('type="search"')
    expect(html).toContain('placeholder="搜索商品、游戏或商品编号"')
    for (const label of ['选择游戏', '商品状态', '浏览时间']) {
      expect(html).toContain(`aria-label="${label}：${label}"`)
    }
    expect(html.match(/data-ui="FilterTrigger" aria-expanded="false"/g)).toHaveLength(3)
    expect(html).not.toContain('footprint-d3-tabs')
    expect(html).not.toContain('全部 15')
    expect(html).not.toContain('role="dialog"')
  })

  it('renders twelve cards in time order without date headings or price-decrease badges', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 12))
    const html = renderPage()
    expect(html).not.toContain('footprint-d3-day')
    expect(html).not.toContain('<h2>')
    expect(html).not.toContain('<em>')
    expect(html).not.toContain('↓')
    expect(html).toContain('共 12 条浏览足迹')
    for (const id of ['1', 'hpjy-1', 'ys-1']) expect(html).toContain(`href="/goods/${id}"`)
    expect(html.match(/class="footprint-d3-meta"/g)).toHaveLength(12)
    expect(html).toContain('¥1,280')
    expect(html).toContain('footprint-v3/back.svg')
    expect(html).toContain('>清空</button>')
    const expected = filterFootprintItems(createFootprintItems(), defaultFootprintFilters)
    const links = html.match(/<a class="footprint-d3-card[\s\S]*?<\/a>/g) ?? []
    expect(links).toHaveLength(12)
    links.forEach((link, index) => expect(link).toContain(`href="/goods/${expected[index].id}"`))
  })

  it('shows a full minute-precision browsing date below every price and a status to its right', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 12))
    const html = renderPage()
    const expected = filterFootprintItems(createFootprintItems(), defaultFootprintFilters)
    const links = html.match(/<a class="footprint-d3-card[\s\S]*?<\/a>/g) ?? []
    expect(links).toHaveLength(12)
    links.forEach((link, index) => {
      expect(link).toMatch(/<span class="footprint-d3-meta"><strong>[^<]+<\/strong><span data-ui="StatusBadge" class="dg-status-badge dg-status-badge--(?:success|warning|neutral|danger) footprint-d3-item-status">[^<]+<\/span><\/span><time /)
      expect(link).toContain(`aria-label="浏览时间 ${formatFootprintTime(expected[index].viewedAt)}"`)
      expect(link).toMatch(/>\d{4}-\d{2}-\d{2} \d{2}:\d{2}<\/time>/)
    })
    for (const status of ['售卖中', '交易中', '已售出', '已下架']) {
      expect(html.match(new RegExp(`footprint-d3-item-status">${status}<`, 'g'))).toHaveLength(3)
    }
  })

  it('offers exactly the three requested browsing-time intervals', () => {
    expect(footprintTimeOptions).toEqual([
      { value: 'last3days', label: '最近3天' },
      { value: 'days3to7', label: '3天到7天' },
      { value: 'before7days', label: '7天以前' },
    ])
  })
})
