import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'
import { FavoriteCard } from './FavoriteCard'
import type { FavoriteStatus, FavoriteView } from '../types/favorite'
import { FavoritesPage } from '../pages/FavoritesPage'
import { FootprintPage } from '../pages/FootprintPage'

const favorite = (status: FavoriteStatus): FavoriteView => ({
  productId: `product-${status}`,
  favoritedAt: new Date(2026, 8, 11, 9, 30).getTime(),
  status,
  gameCode: 'wzry',
  gameName: '王者荣耀',
  gameIcon: '',
  title: '测试商品',
  price: 1280,
  priceDrop: 0,
  image: '/assets/catalog-v2/product-1.png',
  platform: '安卓QQ',
  eliteLevel: '贵族8',
  tags: ['全英雄'],
  navigable: true,
})

describe('catalog pages use shared UI primitives', () => {
  it('renders the shared empty-state action button', () => {
    const html = renderToStaticMarkup(<EmptyState onReset={vi.fn()} />)
    expect(html).toContain('data-ui="EmptyStateView"')
    expect(html).toContain('data-ui="Button"')
    expect(html).toContain('清空筛选')
  })

  it('maps each favorite status to an explicit shared badge tone', () => {
    const tones: Record<FavoriteStatus, string> = { on_sale: 'success', trading: 'warning', sold: 'neutral', off_shelf: 'danger' }
    for (const status of Object.keys(tones) as FavoriteStatus[]) {
      const html = renderToStaticMarkup(<StaticRouter location="/favorites"><FavoriteCard item={favorite(status)} managing={false} selected={false} onToggle={vi.fn()} /></StaticRouter>)
      expect(html).toContain('data-ui="StatusBadge"')
      expect(html).toContain(`dg-status-badge--${tones[status]}`)
    }
  })

  it('uses the same filter trigger primitive for favorites and footprints', () => {
    for (const [location, page] of [['/favorites', <FavoritesPage />], ['/footprints', <FootprintPage />]] as const) {
      const html = renderToStaticMarkup(<StaticRouter location={location}>{page}</StaticRouter>)
      expect(html.match(/data-ui="FilterTrigger"/g)).toHaveLength(3)
      expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(3)
    }
  })
})
