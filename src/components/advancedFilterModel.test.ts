import { describe, expect, it } from 'vitest'
import { emptyFilters } from '../types/catalog'
import { advancedFilterSections, cloneAdvancedFilters, getAdvancedFilterSectionForField, resolveAdvancedFilterSection, toggleFilterBoolean } from './advancedFilterModel'

describe('advanced filter model', () => {
  it('keeps the design section order and resolves legacy section keys', () => {
    expect(advancedFilterSections.map((section) => section.key)).toEqual(['skinCount', 'rank', 'price', 'platform', 'realName', 'secondRealName', 'faceCompensation'])
    expect(resolveAdvancedFilterSection('price')).toBe('price')
    expect(resolveAdvancedFilterSection('hot')).toBe('skinCount')
    expect(resolveAdvancedFilterSection('hero')).toBe('skinCount')
    expect(resolveAdvancedFilterSection('account')).toBe('realName')
    expect(resolveAdvancedFilterSection('other')).toBe('faceCompensation')
    expect(resolveAdvancedFilterSection('unknown')).toBe('skinCount')
    expect(resolveAdvancedFilterSection()).toBe('skinCount')
  })

  it('clones every selectable array', () => {
    const source = { ...emptyFilters, eliteLevels: ['V10'], platforms: ['安卓QQ'], ranks: ['最强王者'], realNames: ['未实名'] }
    const clone = cloneAdvancedFilters(source)
    clone.eliteLevels.push('V12')
    clone.platforms.push('iOS QQ')
    clone.ranks.push('荣耀王者')
    clone.realNames.push('已实名-可改实名')
    expect(source.eliteLevels).toEqual(['V10'])
    expect(source.platforms).toEqual(['安卓QQ'])
    expect(source.ranks).toEqual(['最强王者'])
    expect(source.realNames).toEqual(['未实名'])
  })

  it('toggles boolean filters and maps every filter field to an advanced section', () => {
    expect(toggleFilterBoolean('true', 'true')).toBe('')
    expect(toggleFilterBoolean('true', 'false')).toBe('false')
    expect(toggleFilterBoolean('', 'false')).toBe('false')
    expect(getAdvancedFilterSectionForField('minPrice')).toBe('price')
    expect(getAdvancedFilterSectionForField('maxPrice')).toBe('price')
    expect(getAdvancedFilterSectionForField('minSkin')).toBe('skinCount')
    expect(getAdvancedFilterSectionForField('maxSkin')).toBe('skinCount')
    expect(getAdvancedFilterSectionForField('ranks')).toBe('rank')
    expect(getAdvancedFilterSectionForField('platforms')).toBe('platform')
    expect(getAdvancedFilterSectionForField('realNames')).toBe('realName')
    expect(getAdvancedFilterSectionForField('secondRealName')).toBe('secondRealName')
    expect(getAdvancedFilterSectionForField('faceCompensation')).toBe('faceCompensation')
    expect(getAdvancedFilterSectionForField('negotiable')).toBe('skinCount')
  })
})
