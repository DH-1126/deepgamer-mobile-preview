import { games, products } from '../data/fixtures'
import type { LinkedSearchRequest } from '../../../双端演示/src/contract'
import type { Product, ProductFilters, SortKey } from '../types/catalog'
import { queryLinkedCatalogProducts } from '../linked/linkedCatalogQuery'
import { getLinkedState, isPublicGoods, subscribeLinkedState, toCatalogGame } from '../linked/linkedData'
import { isLinkedDataMode } from '../runtime/dataMode'

function within(value: number, min: string, max: string) {
  return (!min || value >= Number(min)) && (!max || value <= Number(max))
}

export const catalogRepository = {
  getGames: () => Promise.resolve(isLinkedDataMode
    ? (getLinkedState()?.games ?? []).filter((game) => game.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder).map((game) => toCatalogGame(game, (getLinkedState()?.goods ?? []).filter((goods) => goods.gameCode === game.code && isPublicGoods(goods)).length))
    : games),
  getGame: (code: string) => {
    if (!isLinkedDataMode) return games.find((game) => game.code === code) ?? games[1]
    const state = getLinkedState()
    const game = state?.games.find((item) => item.code === code && item.status === 'ACTIVE') ?? state?.games.find((item) => item.status === 'ACTIVE')
    return game ? toCatalogGame(game, state?.goods.filter((goods) => goods.gameCode === game.code && isPublicGoods(goods)).length) : games[1]
  },
  queryProducts(query: string, sort: SortKey, filters: ProductFilters, gameCode = 'wzry', linkedSearchRequest?: LinkedSearchRequest | null): Product[] {
    const keyword = query.trim().toLowerCase()
    const linkedState = getLinkedState()
    if (isLinkedDataMode) return queryLinkedCatalogProducts(linkedState, {
      gameCode, keyword: query, minPrice: filters.minPrice, maxPrice: filters.maxPrice, sort, searchRequest: linkedSearchRequest,
    })
    const source = products
    const result = source.filter((item) => {
      const textMatch = !keyword || `${item.title} ${item.tags.join(' ')}`.toLowerCase().includes(keyword)
      return item.gameCode === gameCode && textMatch
        && within(item.price, filters.minPrice, filters.maxPrice)
        && within(item.skinCount, filters.minSkin, filters.maxSkin)
        && (!filters.minHero || (item.heroCount ?? 0) >= Number(filters.minHero))
        && (!filters.negotiable || String(Boolean(item.negotiable)) === filters.negotiable)
        && (!filters.eliteLevels.length || filters.eliteLevels.includes(item.eliteLevel))
        && (!filters.platforms.length || filters.platforms.includes(item.platform))
        && (!filters.ranks.length || filters.ranks.includes(item.rank))
        && (!filters.realNames.length || filters.realNames.includes(item.realName))
        && (!filters.secondRealName || String(item.secondRealName) === filters.secondRealName)
        && (!filters.faceCompensation || String(item.faceCompensation) === filters.faceCompensation)
    })
    if (sort === 'price_asc') return result.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') return result.sort((a, b) => b.price - a.price)
    if (sort === 'listed_at_desc') return result.sort((a, b) => b.listedAt - a.listedAt)
    return result
  },
  subscribe(listener: () => void) { return isLinkedDataMode ? subscribeLinkedState(listener) : () => undefined },
}
