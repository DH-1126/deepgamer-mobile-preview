import type { ProductFilters } from '../types/catalog'

export const advancedFilterSections = [
  { key: 'skinCount', label: '皮肤数量' },
  { key: 'rank', label: '段位' },
  { key: 'price', label: '价格' },
  { key: 'platform', label: '区服' },
  { key: 'realName', label: '实名状态' },
  { key: 'secondRealName', label: '能否二次实名' },
  { key: 'faceCompensation', label: '能否支持人脸包赔' },
] as const

export type AdvancedFilterSection = (typeof advancedFilterSections)[number]['key']

const legacySectionMap: Record<string, AdvancedFilterSection> = {
  hot: 'skinCount',
  hero: 'skinCount',
  account: 'realName',
  other: 'faceCompensation',
}

export function resolveAdvancedFilterSection(key?: string): AdvancedFilterSection {
  if (advancedFilterSections.some((section) => section.key === key)) return key as AdvancedFilterSection
  return legacySectionMap[key ?? ''] ?? 'skinCount'
}

export function cloneAdvancedFilters(filters: ProductFilters): ProductFilters {
  return {
    ...filters,
    eliteLevels: [...filters.eliteLevels],
    platforms: [...filters.platforms],
    ranks: [...filters.ranks],
    realNames: [...filters.realNames],
  }
}

export function toggleFilterBoolean(current: string, value: 'true' | 'false') {
  return current === value ? '' : value
}

export function getAdvancedFilterSectionForField(field: keyof ProductFilters): AdvancedFilterSection {
  if (field === 'minPrice' || field === 'maxPrice') return 'price'
  if (field === 'minSkin' || field === 'maxSkin') return 'skinCount'
  if (field === 'ranks') return 'rank'
  if (field === 'platforms') return 'platform'
  if (field === 'realNames') return 'realName'
  if (field === 'secondRealName') return 'secondRealName'
  if (field === 'faceCompensation') return 'faceCompensation'
  return 'skinCount'
}
