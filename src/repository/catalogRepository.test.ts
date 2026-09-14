import { describe, expect, it } from 'vitest'
import { games } from '../data/fixtures'
import { emptyFilters, type Product, type ProductFilters } from '../types/catalog'
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

  const filterCases: Array<[string, Partial<ProductFilters>, (item: Product) => boolean]> = [
    ['闭区间价格和皮肤数量', { minPrice: '1200', maxPrice: '2000', minSkin: '200', maxSkin: '400' }, (item: { price: number; skinCount: number }) => item.price >= 1200 && item.price <= 2000 && item.skinCount >= 200 && item.skinCount <= 400],
    ['区服多选 OR', { platforms: ['安卓QQ', 'iOS QQ'] }, (item: { platform: string }) => ['安卓QQ', 'iOS QQ'].includes(item.platform)],
    ['段位多选 OR', { ranks: ['最强王者', '荣耀王者'] }, (item: { rank: string }) => ['最强王者', '荣耀王者'].includes(item.rank)],
    ['实名多选 OR', { realNames: ['未实名', '已实名-可改实名'] }, (item: { realName: string }) => ['未实名', '已实名-可改实名'].includes(item.realName)],
    ['贵族多选 OR', { eliteLevels: ['V10', 'V12'] }, (item: { eliteLevel: string }) => ['V10', 'V12'].includes(item.eliteLevel)],
    ['二次实名 false', { secondRealName: 'false' }, (item: { secondRealName: boolean }) => item.secondRealName === false],
    ['人脸包赔 false', { faceCompensation: 'false' }, (item: { faceCompensation: boolean }) => item.faceCompensation === false],
    ['支持议价 false', { negotiable: 'false' }, (item: { negotiable?: boolean }) => item.negotiable === false],
  ]

  it.each(filterCases)('%s 能按数据契约收敛结果', (_name, partial, matches) => {
    const result = catalogRepository.queryProducts('', 'default', { ...emptyFilters, ...partial })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every(matches)).toBe(true)
  })

  it('将不同字段以 AND 组合', () => {
    const combined = catalogRepository.queryProducts('', 'default', { ...emptyFilters, maxPrice: '1500', ranks: ['最强王者'], platforms: ['安卓QQ'] })
    expect(combined.length).toBeGreaterThan(0)
    expect(combined.every((item) => item.price <= 1500 && item.rank === '最强王者' && item.platform === '安卓QQ')).toBe(true)

  })
})
