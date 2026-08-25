import { describe, expect, it } from 'vitest'
import { catalogRepository } from '../repository/catalogRepository'
import { emptyFilters } from '../types/catalog'
import { getActiveFilterChips, getActiveFilterCount, initialCatalogFilters, removeActiveFilter } from './catalogFilterModel'

describe('catalog v2 filter model', () => {
  it('starts without committed filters', () => {
    expect(getActiveFilterCount(initialCatalogFilters)).toBe(0)
    expect(getActiveFilterChips(initialCatalogFilters)).toEqual([])
  })

  it('removes a range as one committed filter', () => {
    const next = removeActiveFilter({ ...initialCatalogFilters, minPrice: '500', maxPrice: '1500' }, 'minPrice')
    expect(next.minPrice).toBe('')
    expect(next.maxPrice).toBe('')
    expect(getActiveFilterCount(next)).toBe(0)
  })

  it('really filters full-hero and negotiable recommendations', () => {
    const fullHero = catalogRepository.queryProducts('', 'default', { ...emptyFilters, minHero: '108' })
    const negotiable = catalogRepository.queryProducts('', 'default', { ...emptyFilters, negotiable: 'true' })
    expect(fullHero.every((item) => (item.heroCount ?? 0) >= 108)).toBe(true)
    expect(negotiable.every((item) => item.negotiable)).toBe(true)
    expect(catalogRepository.queryProducts('', 'default', initialCatalogFilters).length).toBeGreaterThanOrEqual(10)
  })
})
