import { emptyFilters, type ProductFilters } from '../types/catalog'

export const initialCatalogFilters: ProductFilters = { ...emptyFilters }

export type ActiveFilterChip = {
  key: keyof ProductFilters
  label: string
  editor: 'server' | 'price' | 'drawer'
}

export function getActiveFilterCount(filters: ProductFilters) {
  return [
    filters.platforms.length,
    filters.eliteLevels.length,
    filters.ranks.length,
    filters.realNames.length,
    filters.skins.length,
    filters.minPrice || filters.maxPrice,
    filters.minSkin || filters.maxSkin,
    filters.minHero,
    filters.secondRealName,
    filters.faceCompensation,
    filters.negotiable,
  ].filter(Boolean).length
}

export function getActiveFilterChips(filters: ProductFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  if (filters.platforms.length) {
    const qq = filters.platforms.every((value) => value.includes('QQ'))
    const wechat = filters.platforms.every((value) => value.includes('微信'))
    chips.push({ key: 'platforms', label: qq ? 'QQ区' : wechat ? '微信区' : filters.platforms.join('/'), editor: 'server' })
  }
  if (filters.minHero) chips.push({ key: 'minHero', label: `英雄≥${filters.minHero}`, editor: 'drawer' })
  if (filters.minPrice || filters.maxPrice) chips.push({ key: 'minPrice', label: `¥${filters.minPrice || '0'}-${filters.maxPrice || '不限'}`, editor: 'price' })
  if (filters.minSkin || filters.maxSkin) chips.push({ key: 'minSkin', label: `皮肤${filters.minSkin || '0'}-${filters.maxSkin || '不限'}`, editor: 'drawer' })
  if (filters.ranks.length) chips.push({ key: 'ranks', label: filters.ranks.join('/'), editor: 'drawer' })
  if (filters.eliteLevels.length) chips.push({ key: 'eliteLevels', label: filters.eliteLevels.join('/'), editor: 'drawer' })
  if (filters.realNames.length) chips.push({ key: 'realNames', label: filters.realNames.join('/'), editor: 'drawer' })
  if (filters.secondRealName) chips.push({ key: 'secondRealName', label: filters.secondRealName === 'true' ? '可二次实名' : '不可二次实名', editor: 'drawer' })
  if (filters.faceCompensation) chips.push({ key: 'faceCompensation', label: filters.faceCompensation === 'true' ? '支持人脸包赔' : '不支持人脸包赔', editor: 'drawer' })
  if (filters.skins.length) chips.push({ key: 'skins', label: filters.skins.join('/'), editor: 'drawer' })
  if (filters.negotiable) chips.push({ key: 'negotiable', label: '支持议价', editor: 'drawer' })
  return chips
}

export function removeActiveFilter(filters: ProductFilters, key: keyof ProductFilters): ProductFilters {
  if (key === 'platforms') return { ...filters, platforms: [] }
  if (key === 'minPrice') return { ...filters, minPrice: '', maxPrice: '' }
  if (key === 'minSkin') return { ...filters, minSkin: '', maxSkin: '' }
  if (key === 'ranks') return { ...filters, ranks: [] }
  if (key === 'eliteLevels') return { ...filters, eliteLevels: [] }
  if (key === 'minHero') return { ...filters, minHero: '' }
  if (key === 'negotiable') return { ...filters, negotiable: '' }
  if (key === 'realNames') return { ...filters, realNames: [] }
  if (key === 'secondRealName') return { ...filters, secondRealName: '' }
  if (key === 'faceCompensation') return { ...filters, faceCompensation: '' }
  if (key === 'skins') return { ...filters, skins: [] }
  return filters
}
