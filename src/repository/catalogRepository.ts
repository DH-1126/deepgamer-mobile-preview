import { games, products } from '../data/fixtures'
import type { Product, ProductFilters, SortKey } from '../types/catalog'

function within(value: number, min: string, max: string) {
  return (!min || value >= Number(min)) && (!max || value <= Number(max))
}

export const catalogRepository = {
  getGames: () => Promise.resolve(games),
  getGame: (code: string) => games.find((game) => game.code === code) ?? games[1],
  queryProducts(query: string, sort: SortKey, filters: ProductFilters, gameCode = 'wzry'): Product[] {
    const keyword = query.trim().toLowerCase()
    const result = products.filter((item) => {
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
        && (!filters.skins.length || (filters.skinMatchRule === 'all'
          ? filters.skins.every((skin) => item.tags.some((tag) => tag.includes(skin)))
          : filters.skins.some((skin) => item.tags.some((tag) => tag.includes(skin)))))
    })
    if (sort === 'price_asc') return result.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') return result.sort((a, b) => b.price - a.price)
    if (sort === 'listed_at_desc') return result.sort((a, b) => b.listedAt - a.listedAt)
    return result
  },
}
