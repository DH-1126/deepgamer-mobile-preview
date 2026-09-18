import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyFilters, type ProductFilters } from '../types/catalog'
import { FavoritesPage } from './FavoritesPage'
import { FootprintPage } from './FootprintPage'
import { GameSelectPage } from './GameSelectPage'
import { SearchPage, filterOverridesFromApplied, mergeFilterOverrides } from './SearchPage'

function renderAt(location: string, page: React.ReactNode) {
  return renderToStaticMarkup(<StaticRouter location={location}>{page}</StaticRouter>)
}

describe('explicit search submission', () => {
  it('renders the shared persistent search action without a cancel action', () => {
    const pages = [
      renderAt('/search', <SearchPage />),
      renderAt('/favorites', <FavoritesPage />),
      renderAt('/footprints', <FootprintPage />),
    ]

    for (const html of pages) {
      expect(html).toContain('data-ui="SearchField"')
      expect(html).toMatch(/dg-search-control__submit[^>]*>搜索<\/button>/)
      expect(html).not.toContain('>取消</button>')
    }
  })

  it('uses the new game directory inline search and category navigation', () => {
    const html = renderAt('/game/select?scene=sell', <GameSelectPage />)
    expect(html).toContain('placeholder="请输入游戏名称"')
    expect(html).not.toContain('dg-search-control__submit')
    expect(html).toContain('data-scene="sell"')
    expect(html).toContain('最近浏览')
    expect(html).toContain('热门推荐')
    expect(html).toContain('aria-label="游戏首字母索引"')
    expect(html).toContain('aria-label="游戏类型"')
  })

  it('keeps manually applied filters while replacing old search-intent filters', () => {
    const oldSearchFilters: ProductFilters = { ...emptyFilters, ranks: ['荣耀王者'], maxPrice: '1500' }
    const applied: ProductFilters = { ...oldSearchFilters, platforms: ['安卓QQ'], maxPrice: '1200' }
    const overrides = filterOverridesFromApplied(applied, oldSearchFilters)
    const nextSearchFilters: ProductFilters = { ...emptyFilters, minSkin: '200' }

    expect(overrides).toEqual({ platforms: ['安卓QQ'], maxPrice: '1200' })
    expect(mergeFilterOverrides(nextSearchFilters, overrides)).toEqual({
      ...emptyFilters,
      minSkin: '200',
      platforms: ['安卓QQ'],
      maxPrice: '1200',
    })
  })

  it('keeps an explicit manual removal as an empty override', () => {
    const searchFilters: ProductFilters = { ...emptyFilters, ranks: ['荣耀王者'] }
    const applied: ProductFilters = { ...searchFilters, ranks: [] }
    const overrides = filterOverridesFromApplied(applied, searchFilters)

    expect(overrides).toEqual({ ranks: [] })
    expect(mergeFilterOverrides({ ...emptyFilters, ranks: ['星耀王者'] }, overrides).ranks).toEqual([])
  })
})
