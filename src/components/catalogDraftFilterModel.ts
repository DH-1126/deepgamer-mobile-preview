import { emptyFilters, type ProductFilters } from '../types/catalog'

export type CatalogDraftFilterSection = 'hot' | 'skin' | 'rank' | 'platform' | 'price' | 'hero' | 'account' | 'other'

export function countCatalogDraftSelections(section: CatalogDraftFilterSection, filters: ProductFilters) {
  if (section === 'hot') return filters.eliteLevels.length + Number(filters.negotiable === 'true')
  if (section === 'skin') return Number(Boolean(filters.minSkin || filters.maxSkin))
  if (section === 'rank') return filters.ranks.length
  if (section === 'platform') return filters.platforms.length
  if (section === 'price') return Number(Boolean(filters.minPrice || filters.maxPrice))
  if (section === 'hero') return Number(Boolean(filters.minHero))
  if (section === 'account') return filters.realNames.length + Number(Boolean(filters.secondRealName))
  return Number(Boolean(filters.faceCompensation)) + Number(filters.negotiable === 'true')
}

export function hasCatalogDraftSelections(filters: ProductFilters) {
  return (Object.keys(emptyFilters) as Array<keyof ProductFilters>).some((key) => {
    const value = filters[key]
    const emptyValue = emptyFilters[key]
    return Array.isArray(value)
      ? value.length > 0
      : value !== emptyValue
  })
}
