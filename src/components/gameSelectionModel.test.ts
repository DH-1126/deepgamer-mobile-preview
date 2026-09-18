import { describe, expect, it } from 'vitest'
import { gameDirectory } from '../data/gameDirectory'
import { buildGameSelectRoute, filterDirectoryGames, getGameSelectionTarget, groupDirectoryGames, nextRecentGames } from './gameSelectionModel'

describe('game directory navigation', () => {
  it('retains the entry scene, current game and search intent', () => {
    expect(buildGameSelectRoute({ scene: 'sell', current: 'peace', search: true })).toBe('/game/select?scene=sell&current=peace&search=1')
    expect(buildGameSelectRoute()).toBe('/game/select?scene=buy')
  })

  it('maps the same game to the correct buying and recycling identifiers', () => {
    for (const [code, sellCode] of [['hpjy', 'peace'], ['sjzxd', 'delta'], ['ys', 'genshin']]) {
      const game = gameDirectory.find(item => item.code === code)!
      expect(getGameSelectionTarget(game, 'buy')).toBe(`/game?gameCode=${code}`)
      expect(getGameSelectionTarget(game, 'sell')).toBe(`/appraisal?game=${sellCode}`)
    }
  })

  it('does not silently open another game for an unavailable scene', () => {
    expect(getGameSelectionTarget(gameDirectory.find(game => game.code === 'lol')!, 'sell')).toBeNull()
    expect(getGameSelectionTarget(gameDirectory.find(game => game.code === 'apex')!, 'buy')).toBeNull()
  })

  it('combines trimmed name or alias search with platform filtering', () => {
    expect(filterDirectoryGames(gameDirectory, '  DELTA ', 'pc').map(game => game.code)).toEqual(['sjzxd'])
    expect(filterDirectoryGames(gameDirectory, '王者', 'pc')).toEqual([])
    expect(filterDirectoryGames(gameDirectory, '王者', 'mobile').map(game => game.code)).toEqual(['wzry'])
    expect(filterDirectoryGames(gameDirectory, '不存在的游戏', 'all')).toEqual([])
  })

  it('groups games alphabetically and keeps recent selections unique and capped', () => {
    const groups = groupDirectoryGames(gameDirectory)
    expect(groups[0].initial).toBe('A')
    expect(groups[0].items.map(game => game.code)).toEqual(['aqtw', 'aqtw-infinite', 'aqcs', 'apex'])
    expect(nextRecentGames(['wzry', 'lol', 'ys', 'hpjy', 'luoke'], 'ys')).toEqual(['ys', 'wzry', 'lol', 'hpjy', 'luoke'])
    expect(nextRecentGames(['wzry', 'lol', 'ys', 'hpjy', 'luoke'], 'sjzxd')).toEqual(['sjzxd', 'wzry', 'lol', 'ys', 'hpjy'])
  })
})
