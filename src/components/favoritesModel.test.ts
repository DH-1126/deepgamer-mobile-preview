import { describe, expect, it } from 'vitest'
import { createDefaultFavoriteRecords } from '../data/favoriteFixtures'
import type { FavoriteRecord } from '../types/favorite'
import { clearSelectionForFilter, filterFavorites, recordsAfterDeletion, selectionState, toggleAllVisible, toggleFavoriteSelection } from './favoritesModel'

const day = 86_400_000
const now = 2_000_000_000_000
const records: FavoriteRecord[] = [
  { productId: '1', favoritedAt: now - 7 * day, statusSnapshot: 'on_sale' },
  { productId: '2114872829163482747', favoritedAt: now - 30 * day, statusSnapshot: 'sold' },
  { productId: 'missing', favoritedAt: now - day, statusSnapshot: 'off_shelf' },
  { productId: '2', favoritedAt: now - 2 * day, statusSnapshot: 'trading' },
]

describe('favoritesModel', () => {
  it('默认两条收藏分别投影王者与三角洲', () => {
    const result = filterFavorites(createDefaultFavoriteRecords(now), { gameCode: 'all', status: 'all', time: 'all' }, now)
    expect(result).toHaveLength(2)
    expect(result.map((item) => item.gameName)).toEqual(['王者荣耀', '三角洲行动'])
  })

  it('组合游戏、状态和时间筛选，7/30天边界包含', () => {
    expect(filterFavorites(records, { gameCode: 'wzry', status: 'on_sale', time: '7d' }, now).map((item) => item.productId)).toEqual(['1'])
    expect(filterFavorites(records, { gameCode: 'sjzxd', status: 'sold', time: '30d' }, now).map((item) => item.productId)).toEqual(['2114872829163482747'])
    expect(filterFavorites(records, { gameCode: 'all', status: 'trading', time: '7d' }, now).map((item) => item.productId)).toEqual(['2'])
    expect(filterFavorites(records, { gameCode: 'all', status: 'off_shelf', time: '7d' }, now)[0]).toMatchObject({ productId: 'missing', navigable: false })
  })

  it('默认按时间稳定倒序', () => {
    const equal: FavoriteRecord[] = [{ productId: '1', favoritedAt: 2 }, { productId: '2', favoritedAt: 2 }, { productId: '3', favoritedAt: 3 }]
    expect(filterFavorites(equal, { gameCode: 'all', status: 'all', time: 'all' }, now).map((item) => item.productId)).toEqual(['3', '1', '2'])
  })

  it('搜索标题、游戏名、平台、商品编号和标签，并与筛选组合生效', () => {
    const all = { gameCode: 'all', status: 'all', time: 'all' } as const
    expect(filterFavorites(records, all, now, '王者荣耀').map((item) => item.productId)).toEqual(['2', '1'])
    expect(filterFavorites(records, all, now, 'QQ').map((item) => item.productId)).toContain('1')
    expect(filterFavorites(records, all, now, '2114872829163482747').map((item) => item.productId)).toEqual(['2114872829163482747'])
    expect(filterFavorites(records, all, now, 'WZ0001').map((item) => item.productId)).toEqual(['1'])
    expect(filterFavorites(records, { gameCode: 'wzry', status: 'trading', time: '7d' }, now, '王者').map((item) => item.productId)).toEqual(['2'])
    expect(filterFavorites(records, { gameCode: 'wzry', status: 'on_sale', time: '7d' }, now, 'V10').map((item) => item.productId)).toEqual(['1'])
  })

  it('空白搜索等同于未搜索', () => {
    const filters = { gameCode: 'all', status: 'all', time: 'all' } as const
    expect(filterFavorites(records, filters, now, '   ')).toEqual(filterFavorites(records, filters, now))
  })

  it('只对当前结果全选，筛选变化清空，删除模型保留未选项', () => {
    let selection = toggleFavoriteSelection(new Set(), '1')
    expect(selectionState(selection, ['1', '2'])).toBe('mixed')
    selection = toggleAllVisible(selection, ['1', '2114872829163482747'])
    expect(selectionState(selection, ['1', '2114872829163482747'])).toBe(true)
    expect(recordsAfterDeletion(records, selection).map((item) => item.productId)).toEqual(['missing', '2'])
    expect(clearSelectionForFilter().size).toBe(0)
  })
})
