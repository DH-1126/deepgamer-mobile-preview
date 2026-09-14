import type { LinkedSearchRequest, LinkedState } from '../../../双端演示/src/contract'
import { matchesLinkedSearch } from '../../../双端演示/src/search-config'
import type { Product, SortKey } from '../types/catalog'
import { isPublicGoods, toCatalogProduct } from './linkedData'

export type LinkedCatalogQuery = {
  gameCode: string
  keyword: string
  minPrice: string
  maxPrice: string
  sort: SortKey
  searchRequest?: LinkedSearchRequest | null
}

function priceFen(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN
}

export function queryLinkedCatalogProducts(state: LinkedState | null, query: LinkedCatalogQuery): Product[] {
  if (!state) return []
  const gameActive = state.games.some((game) => game.code === query.gameCode && game.status === 'ACTIVE')
  if (!gameActive) return []
  const keyword = query.keyword.trim().toLocaleLowerCase('zh-CN')
  const minFen = priceFen(query.minPrice)
  const maxFen = priceFen(query.maxPrice)
  if (Number.isNaN(minFen) || Number.isNaN(maxFen) || minFen !== null && maxFen !== null && minFen > maxFen) return []
  const hasDynamicClauses = Boolean(query.searchRequest?.clauses.length)

  const result = state.goods.filter((goods) => {
    if (!isPublicGoods(goods) || goods.gameCode !== query.gameCode) return false
    if (keyword && !`${goods.title} ${goods.description}`.toLocaleLowerCase('zh-CN').includes(keyword)) return false
    if (minFen !== null && goods.priceFen < minFen || maxFen !== null && goods.priceFen > maxFen) return false
    // An unavailable SEARCH baseline never hides the catalog. Exact snapshot matching
    // starts only after the user has explicitly selected at least one dynamic clause.
    if (hasDynamicClauses && !matchesLinkedSearch(state, goods, query.searchRequest!)) return false
    return true
  }).map(toCatalogProduct)

  if (query.sort === 'price_asc') return result.sort((a, b) => a.price - b.price)
  if (query.sort === 'price_desc') return result.sort((a, b) => b.price - a.price)
  if (query.sort === 'listed_at_desc') return result.sort((a, b) => b.listedAt - a.listedAt)
  return result
}
