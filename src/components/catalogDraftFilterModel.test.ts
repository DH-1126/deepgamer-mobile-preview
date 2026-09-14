import { describe, expect, it } from 'vitest'
import { emptyFilters } from '../types/catalog'
import { countCatalogDraftSelections, hasCatalogDraftSelections } from './catalogDraftFilterModel'

describe('draft 3 catalog filter navigation', () => {
  it('groups the committed fields into the eight design categories', () => {
    const filters = {
      ...emptyFilters,
      eliteLevels: ['V10'],
      negotiable: 'true',
      minSkin: '100',
      realNames: ['未实名'],
      secondRealName: 'true',
    }

    expect(countCatalogDraftSelections('hot', filters)).toBe(2)
    expect(countCatalogDraftSelections('skin', filters)).toBe(1)
    expect(countCatalogDraftSelections('account', filters)).toBe(2)
    expect(countCatalogDraftSelections('other', filters)).toBe(1)
  })

  it('only displays the restored-state notice when a real condition is present', () => {
    expect(hasCatalogDraftSelections({ ...emptyFilters })).toBe(false)
    expect(hasCatalogDraftSelections({ ...emptyFilters, ranks: ['荣耀王者'] })).toBe(true)
  })
})
