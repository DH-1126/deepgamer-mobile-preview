import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { SearchResultProductCard } from './SearchPage'
import { products } from '../data/fixtures'

describe('search result product cards', () => {
  it('uses the catalog card with a real verification flag and no wanted count', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/search"><SearchResultProductCard product={{ ...products[0], verified: true }} /></StaticRouter>)
    expect(html).toContain('catalog-product-card')
    expect(html).toContain(`href="/goods/${products[0].id}"`)
    expect(html).toContain('已验号')
    expect(html).not.toContain('人想要')
    expect(html).not.toContain('search-v2-product-visual')
  })

  it('preserves matching explanations for partial search results', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/search"><SearchResultProductCard product={products[0]} showFit
      satisfied={[{ id: 'game', kind: 'game', label: '王者荣耀', value: '王者荣耀' }]}
      missing={[{ id: 'price', kind: 'price', label: '预算', value: '≤¥500' }]} /></StaticRouter>)
    expect(html).toContain('✓ 满足 王者荣耀')
    expect(html).toContain('× 未满足 ≤¥500')
    expect(html).toContain('catalog-product-card')
  })
})
