import { describe, expect, it } from 'vitest'
import { emptyFilters } from '../types/catalog'
import { catalogRepository } from './catalogRepository'

describe('catalogRepository', () => {
  it('按价格升序返回商品', () => {
    const result = catalogRepository.queryProducts('', 'price_asc', emptyFilters)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].price).toBeLessThanOrEqual(result[1].price)
  })

  it('组合关键字与价格筛选', () => {
    const result = catalogRepository.queryProducts('蔷薇恋人', 'default', { ...emptyFilters, maxPrice: '1200' })
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(700)
  })
})
