import { describe, expect, it } from 'vitest'
import { coCreationServices, homeGames, principles, recentGames, tradeFeatures } from './homeData'

describe('home data', () => {
  it('keeps the Figma game order and deliberate Peace Elite repeat', () => {
    expect(homeGames.map((game) => game.name)).toEqual([
      '王者荣耀', '和平精英', '三角洲', '原神',
      '第五人格', '超自然行动组', '和平精英', '英雄联盟',
    ])
    expect(homeGames).toHaveLength(8)
  })

  it('keeps all homepage content groups complete', () => {
    expect(recentGames).toHaveLength(2)
    expect(principles).toHaveLength(3)
    expect(tradeFeatures).toHaveLength(6)
    expect(coCreationServices).toHaveLength(3)
  })
})
