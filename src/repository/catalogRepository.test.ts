import { describe, expect, it } from 'vitest'
import { games } from '../data/fixtures'
import { emptyFilters } from '../types/catalog'
import { catalogRepository } from './catalogRepository'

describe('catalogRepository', () => {
  it.each([
    ['price_asc', (previous: number, current: number) => previous <= current],
    ['price_desc', (previous: number, current: number) => previous >= current],
  ] as const)('按 %s 价格顺序返回商品', (sort, inOrder) => {
    const result = catalogRepository.queryProducts('', sort, emptyFilters)
    expect(result.length).toBeGreaterThan(1)
    expect(result.slice(1).every((item, index) => inOrder(result[index].price, item.price))).toBe(true)
  })

  it('按最新上架时间降序返回商品', () => {
    const result = catalogRepository.queryProducts('', 'listed_at_desc', emptyFilters)
    expect(result.length).toBeGreaterThan(1)
    expect(result.slice(1).every((item, index) => result[index].listedAt >= item.listedAt)).toBe(true)
  })

  it('综合排序保持原始商品顺序', () => {
    const result = catalogRepository.queryProducts('', 'default', emptyFilters)
    expect(result.slice(0, 3).map((item) => item.id)).toEqual(['1', '2', '3'])
  })

  it('组合关键字与价格筛选', () => {
    const result = catalogRepository.queryProducts('蔷薇恋人', 'default', { ...emptyFilters, maxPrice: '1200' })
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(700)
  })

  it('每个可切换游戏都有对应商品列表', () => {
    for (const game of games) {
      expect(catalogRepository.queryProducts('', 'default', emptyFilters, game.code).length, game.name).toBeGreaterThan(0)
    }
  })
})
