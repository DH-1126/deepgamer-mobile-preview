import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { products } from '../data/fixtures'
import type { Product } from '../types/catalog'
import { ProductCard } from './ProductCard'

const product = (overrides: Partial<Product> = {}): Product => ({
  ...products[0],
  id: 'catalog-card-test',
  wantCount: 37,
  ...overrides,
})

describe('ProductCard catalogV2', () => {
  it('renders both image badges and omits the obsolete want count', () => {
    const html = renderToStaticMarkup(<ProductCard product={product({ verified: true })} variant="catalogV2" />)

    expect(html).toContain('class="dg-list-card-shell__verified"')
    expect(html).toContain('>已验号</b>')
    expect(html).toContain('class="dg-list-card-shell__badge"')
    expect(html).toContain('>贵族10</span>')
    expect(html).not.toContain('人想要')
    expect(html).toContain('data-list-card-variant="catalogV2"')
    expect(html).toMatch(/<strong class="dg-list-card-shell__price">[^<]*1,280<\/strong>/)
  })

  it('does not claim an unverified product was checked', () => {
    const html = renderToStaticMarkup(<ProductCard product={product({ verified: false })} variant="catalogV2" />)

    expect(html).not.toContain('dg-list-card-shell__verified')
    expect(html).not.toContain('已验号')
    expect(html).toContain('dg-list-card-shell__badge')
  })

  it('keeps the default card variant independent from the catalog skin', () => {
    const html = renderToStaticMarkup(<ProductCard product={product()} />)

    expect(html).toContain('product-card')
    expect(html).toContain('data-list-card-variant="default"')
    expect(html).not.toContain('catalog-product-card')
  })

  it('keeps one Link root and retains compact as a modifier of the default shell', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/games"><ProductCard product={product()} compact to="/goods/catalog-card-test" /></StaticRouter>)

    expect((html.match(/<a\b/g) ?? [])).toHaveLength(1)
    expect(html).toContain('dg-list-card-shell--default')
    expect(html).toContain('dg-list-card-shell--compact')
    expect(html).toContain('href="/goods/catalog-card-test"')
  })

  it('preserves zero price and renders an explicit placeholder instead of a broken image', () => {
    const html = renderToStaticMarkup(<ProductCard product={product({ image: '', price: 0 })} />)

    expect(html).toContain('暂无图片')
    expect(html).not.toContain('<img')
    expect(html).toContain('¥</small>0.00')
  })

  it('rejects an invalid explicit runtime variant', () => {
    expect(() => renderToStaticMarkup(<ProductCard product={product()} variant={'masonry' as 'default'} />))
      .toThrow('调用方指定了不支持的列表卡片布局')
  })
})
