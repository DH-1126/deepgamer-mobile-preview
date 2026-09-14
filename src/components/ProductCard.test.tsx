import { renderToStaticMarkup } from 'react-dom/server'
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

    expect(html).toContain('class="catalog-product-verified"')
    expect(html).toContain('>已验号</b>')
    expect(html).toContain('class="catalog-product-image-badge"')
    expect(html).toContain('>贵族10</span>')
    expect(html).not.toContain('人想要')
    expect(html).toMatch(/<footer><strong>[^<]*1,280<\/strong><\/footer>/)
  })

  it('does not claim an unverified product was checked', () => {
    const html = renderToStaticMarkup(<ProductCard product={product({ verified: false })} variant="catalogV2" />)

    expect(html).not.toContain('catalog-product-verified')
    expect(html).not.toContain('已验号')
    expect(html).toContain('catalog-product-image-badge')
  })

  it('keeps the default card variant independent from the catalog skin', () => {
    const html = renderToStaticMarkup(<ProductCard product={product()} />)

    expect(html).toContain('class="product-card ')
    expect(html).not.toContain('catalog-product-card')
  })
})
