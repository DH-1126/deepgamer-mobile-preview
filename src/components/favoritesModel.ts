import { productDetailRepository } from '../repository/productDetailRepository'
import type { FavoriteFilters, FavoriteRecord, FavoriteView } from '../types/favorite'

export const emptyFavoriteFilters: FavoriteFilters = { gameCode: 'all', status: 'all', time: 'all' }

export function projectFavorite(record: FavoriteRecord): FavoriteView {
  const detail = productDetailRepository.getById(record.productId)
  const status = record.statusSnapshot ?? (detail?.status === 'on_sale' ? 'on_sale' : detail?.status === 'reserved' ? 'trading' : detail?.status === 'sold' ? 'sold' : 'off_shelf')
  return {
    productId: record.productId, favoritedAt: record.favoritedAt, status,
    gameCode: detail?.gameCode ?? 'unknown', gameName: detail?.gameName ?? '未知游戏', gameIcon: detail?.gameIcon ?? '',
    title: detail?.title ?? `商品 ${record.productId}`, price: detail?.price ?? 0, image: detail?.gallery[0] ?? '', platform: detail?.platform ?? '商品已下架',
    eliteLevel: detail?.summary[0]?.value ?? '', tags: detail?.summary.slice(0, 2).map((item) => `${item.label}${item.value}`) ?? [],
    navigable: Boolean(detail && status !== 'off_shelf'),
  }
}

export function filterFavorites(records: FavoriteRecord[], filters: FavoriteFilters, now: number) {
  const lowerBound = filters.time === '7d' ? now - 7 * 86_400_000 : filters.time === '30d' ? now - 30 * 86_400_000 : -Infinity
  return records.map((record, index) => ({ view: projectFavorite(record), index }))
    .filter(({ view }) => (filters.gameCode === 'all' || view.gameCode === filters.gameCode) && (filters.status === 'all' || view.status === filters.status) && view.favoritedAt >= lowerBound)
    .sort((a, b) => b.view.favoritedAt - a.view.favoritedAt || a.index - b.index)
    .map(({ view }) => view)
}

export function toggleFavoriteSelection(selection: Set<string>, productId: string) {
  const next = new Set(selection)
  next.has(productId) ? next.delete(productId) : next.add(productId)
  return next
}

export function toggleAllVisible(selection: Set<string>, visibleIds: string[]) {
  const next = new Set(selection)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id))
  visibleIds.forEach((id) => allSelected ? next.delete(id) : next.add(id))
  return next
}

export function selectionState(selection: Set<string>, visibleIds: string[]) {
  const selected = visibleIds.filter((id) => selection.has(id)).length
  return selected === 0 ? false : selected === visibleIds.length ? true : 'mixed'
}

export function clearSelectionForFilter() { return new Set<string>() }
export function recordsAfterDeletion(records: FavoriteRecord[], selected: Set<string>) { return records.filter((record) => !selected.has(record.productId)) }

export function formatFavoriteTime(timestamp: number) {
  const date = new Date(timestamp)
  const parts = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
