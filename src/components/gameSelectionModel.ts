import type { GameDirectoryEntry, GamePlatform } from '../data/gameDirectory'

export type GameSelectionScene = 'buy' | 'sell'
export function buildGameSelectRoute({ scene = 'buy', current, search = false }: { scene?: GameSelectionScene; current?: string; search?: boolean } = {}) {
  const params = new URLSearchParams({ scene })
  if (current) params.set('current', current)
  if (search) params.set('search', '1')
  return `/game/select?${params}`
}

export function getGameSelectionTarget(game: GameDirectoryEntry, scene: GameSelectionScene): string | null {
  const code = scene === 'sell' ? game.sellCode : game.buyCode
  if (!code) return null
  return scene === 'sell' ? `/appraisal?game=${encodeURIComponent(code)}` : `/game?gameCode=${encodeURIComponent(code)}`
}

export function filterDirectoryGames(games: GameDirectoryEntry[], query: string, platform: 'all' | GamePlatform) {
  const keyword = query.trim().toLocaleLowerCase('zh-CN')
  return games.filter(game => (platform === 'all' || game.platforms.includes(platform))
    && (!keyword || `${game.name} ${game.code} ${game.keywords ?? ''}`.toLocaleLowerCase('zh-CN').includes(keyword)))
}

export function groupDirectoryGames(games: GameDirectoryEntry[]) {
  const groups = new Map<string, GameDirectoryEntry[]>()
  for (const game of games) groups.set(game.initial, [...(groups.get(game.initial) ?? []), game])
  return [...groups].sort(([a], [b]) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)).map(([initial, items]) => ({ initial, items }))
}

export function nextRecentGames(current: string[], selected: string) {
  return [selected, ...current.filter(code => code !== selected)].slice(0, 5)
}
