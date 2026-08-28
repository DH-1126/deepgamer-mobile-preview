import { games } from '../data/fixtures'
import { emptyFilters, type ProductFilters } from '../types/catalog'

export type SearchConditionKind = 'game' | 'hero' | 'rank' | 'price' | 'skin' | 'elite' | 'server'

export type SearchCondition = {
  id: string
  kind: SearchConditionKind
  label: string
  value: string
  filters?: Partial<ProductFilters>
}

export type SearchIntent = {
  query: string
  gameCode: string
  gameName: string
  conditions: SearchCondition[]
}

const gameAliases: ReadonlyArray<[string, string[]]> = [
  ['sjzxd', ['三角洲行动', '三角洲']],
  ['wzry', ['王者荣耀', '王者']],
  ['hpjy', ['和平精英', '和平']],
  ['lol', ['英雄联盟', 'lol']],
  ['ys', ['原神']],
  ['valorant', ['无畏契约', '瓦罗兰特', '瓦']],
]

const ranks = ['荣耀王者', '最强王者', '至尊星耀', '永恒钻石'] as const

function findGame(query: string) {
  const normalized = query.toLowerCase()
  const matched = gameAliases.find(([, aliases]) => aliases.some((alias) => normalized.includes(alias.toLowerCase())))
  const code = matched?.[0] ?? 'wzry'
  return games.find((game) => game.code === code) ?? games[1]
}

function numberMatch(query: string, pattern: RegExp) {
  const match = query.match(pattern)
  return match?.[1] ?? ''
}

export function recognizeSearchIntent(value: string): SearchIntent {
  const query = value.trim().replace(/\s+/g, ' ')
  const game = findGame(query)
  if (!query) return { query, gameCode: game.code, gameName: game.name, conditions: [] }

  const conditions: SearchCondition[] = []
  const explicitGame = gameAliases.some(([, aliases]) => aliases.some((alias) => query.toLowerCase().includes(alias.toLowerCase())))
  if (explicitGame) conditions.push({ id: 'game', kind: 'game', label: '游戏', value: game.name })

  const heroCount = numberMatch(query, /(?:英雄\s*|)(\d{2,3})\s*英雄?/) || numberMatch(query, /英雄\s*(\d{2,3})/)
  if (heroCount) conditions.push({ id: 'hero', kind: 'hero', label: '英雄数量', value: `≥${heroCount}`, filters: { minHero: heroCount } })
  else if (query.includes('全英雄')) conditions.push({ id: 'hero', kind: 'hero', label: '英雄数量', value: '全英雄', filters: { minHero: '108' } })

  const exactRank = ranks.find((rank) => query.includes(rank))
  if (exactRank) conditions.push({ id: 'rank', kind: 'rank', label: '段位', value: exactRank, filters: { ranks: [exactRank] } })
  else if (/王者段位|段位王者/.test(query)) conditions.push({ id: 'rank', kind: 'rank', label: '段位', value: '王者', filters: { ranks: ['最强王者'] } })

  const range = query.match(/(?:预算|价格|价位)?\s*[¥￥]?\s*(\d{2,6})\s*(?:-|~|—|至|到)\s*[¥￥]?\s*(\d{2,6})/)
  const budget = numberMatch(query, /预算\s*[¥￥]?\s*(\d{2,6})/) || numberMatch(query, /[¥￥]?\s*(\d{2,6})\s*(?:元)?以内/)
  const minimum = numberMatch(query, /[¥￥]?\s*(\d{2,6})\s*(?:元)?以上/)
  if (range) conditions.push({ id: 'price', kind: 'price', label: '价格', value: `¥${range[1]}-${range[2]}`, filters: { minPrice: range[1], maxPrice: range[2] } })
  else if (budget) conditions.push({ id: 'price', kind: 'price', label: '价格', value: `≤¥${budget}`, filters: { maxPrice: budget } })
  else if (minimum) conditions.push({ id: 'price', kind: 'price', label: '价格', value: `≥¥${minimum}`, filters: { minPrice: minimum } })

  const skinCount = numberMatch(query, /(?:皮肤\s*|)(\d{2,4})\s*皮肤?/) || numberMatch(query, /皮肤\s*(\d{2,4})/)
  if (query.includes('全皮肤')) conditions.push({ id: 'skin', kind: 'skin', label: '皮肤', value: '全皮肤', filters: { minSkin: '700' } })
  else if (skinCount) conditions.push({ id: 'skin', kind: 'skin', label: '皮肤数量', value: `≥${skinCount}`, filters: { minSkin: skinCount } })

  const elite = numberMatch(query.toLowerCase(), /(?:贵族|v)\s*(\d{1,2})/)
  if (elite) conditions.push({ id: 'elite', kind: 'elite', label: '贵族等级', value: `V${elite}`, filters: { eliteLevels: [`V${elite}`] } })

  if (/qq区|qq服|安卓qq|ios\s*qq/i.test(query)) conditions.push({ id: 'server', kind: 'server', label: '游戏区服', value: 'QQ', filters: { platforms: ['安卓QQ', 'iOS QQ'] } })
  else if (/微信区|微信服|安卓微信|ios\s*微信/i.test(query)) conditions.push({ id: 'server', kind: 'server', label: '游戏区服', value: '微信', filters: { platforms: ['安卓微信', 'iOS 微信'] } })
  else if (/steam/i.test(query)) conditions.push({ id: 'server', kind: 'server', label: '游戏区服', value: 'Steam', filters: { platforms: ['Steam'] } })

  return { query, gameCode: game.code, gameName: game.name, conditions }
}

export function filtersFromSearchIntent(intent: SearchIntent, excludedIds: Iterable<string> = []): ProductFilters {
  const excluded = new Set(excludedIds)
  return intent.conditions.reduce<ProductFilters>((filters, condition) => {
    if (excluded.has(condition.id) || !condition.filters) return filters
    const next = { ...filters, ...condition.filters }
    if (condition.filters.platforms) next.platforms = [...condition.filters.platforms]
    if (condition.filters.ranks) next.ranks = [...condition.filters.ranks]
    if (condition.filters.eliteLevels) next.eliteLevels = [...condition.filters.eliteLevels]
    return next
  }, { ...emptyFilters })
}

export function catalogUrlFromSearchIntent(intent: SearchIntent, excludedIds: Iterable<string> = []) {
  const excluded = new Set(excludedIds)
  const filters = filtersFromSearchIntent(intent, excluded)
  const params = new URLSearchParams({ gameCode: intent.gameCode, source: intent.query })
  if (filters.minHero) params.set('minHero', filters.minHero)
  if (filters.minPrice) params.set('minPrice', filters.minPrice)
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
  if (filters.minSkin) params.set('minSkin', filters.minSkin)
  if (filters.maxSkin) params.set('maxSkin', filters.maxSkin)
  if (filters.ranks.length) params.set('ranks', filters.ranks.join(','))
  if (filters.eliteLevels.length) params.set('eliteLevels', filters.eliteLevels.join(','))
  if (filters.platforms.length) params.set('platforms', filters.platforms.join(','))
  return `/game?${params.toString()}`
}

export function relaxationLabel(condition: SearchCondition, nearestPrice?: number) {
  if (condition.kind === 'price' && nearestPrice) return `预算提高到 ¥${nearestPrice.toLocaleString('zh-CN')}`
  if (condition.kind === 'skin') return `去掉 ${condition.value}`
  if (condition.kind === 'elite') return '贵族改为 ≥10'
  return `放宽 ${condition.label}「${condition.value}」`
}
