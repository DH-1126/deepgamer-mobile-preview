import { describe, expect, it } from 'vitest'
import { recognizeSearchIntent } from './searchIntentModel'
import { allSearchConditionIds, nextSearchPriceSort } from './searchResultsModel'

describe('draft 3 search result state', () => {
  it('cycles price from any non-price sort into ascending, then descending', () => {
    expect(nextSearchPriceSort('default')).toBe('price_asc')
    expect(nextSearchPriceSort('listed_at_desc')).toBe('price_asc')
    expect(nextSearchPriceSort('price_asc')).toBe('price_desc')
    expect(nextSearchPriceSort('price_desc')).toBe('price_asc')
  })

  it('clearing result conditions excludes every recognized condition', () => {
    const intent = recognizeSearchIntent('王者 108英雄 500-1500')
    expect([...allSearchConditionIds(intent)]).toEqual(['game', 'hero', 'price'])
  })
})
