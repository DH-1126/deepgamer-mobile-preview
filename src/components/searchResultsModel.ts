import type { SortKey } from '../types/catalog'
import type { SearchIntent } from './searchIntentModel'

export function nextSearchPriceSort(current: SortKey): SortKey {
  return current === 'price_asc' ? 'price_desc' : 'price_asc'
}

export function allSearchConditionIds(intent: SearchIntent) {
  return new Set(intent.conditions.map((condition) => condition.id))
}
