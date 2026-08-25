import { describe, expect, it, vi } from 'vitest'
import { FAVORITES_STORAGE_KEY } from '../data/favoriteFixtures'
import type { FavoriteStorage } from './favoriteRepository'
import { createFavoriteRepository } from './favoriteRepository'

function storageFixture(initial: Record<string, string> = {}): FavoriteStorage & { values: Map<string, string>; fail: boolean } {
  const values = new Map(Object.entries(initial))
  return {
    values, fail: false,
    get length() { return values.size },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { if (this.fail) throw new Error('quota'); values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

describe('favoriteRepository', () => {
  it('首次恰好 seed 两条，持久化空数组不重灌', () => {
    const storage = storageFixture()
    const repository = createFavoriteRepository({ storage, now: () => 1_800_000_000_000 })
    expect(repository.list()).toHaveLength(2)
    expect(repository.list().map((item) => item.productId)).toEqual(['1', '2114872829163482747'])

    const emptyStorage = storageFixture({ [FAVORITES_STORAGE_KEY]: '[]' })
    expect(createFavoriteRepository({ storage: emptyStorage }).list()).toEqual([])
  })

  it('迁移旧 true/false 键，旧键存在时不会 seed', () => {
    const storage = storageFixture({ 'favorite:3': 'true', 'favorite:4': 'false' })
    const repository = createFavoriteRepository({ storage, now: () => 1234 })
    expect(repository.list()).toEqual([{ productId: '3', favoritedAt: 1234, statusSnapshot: 'on_sale' }])
    expect(JSON.parse(storage.getItem(FAVORITES_STORAGE_KEY)!)).toHaveLength(1)
  })

  it('add/remove 幂等、保留时间并同步订阅与旧键', () => {
    const storage = storageFixture({ [FAVORITES_STORAGE_KEY]: '[]' })
    const repository = createFavoriteRepository({ storage, now: () => 555 })
    const listener = vi.fn(); repository.subscribe(listener)
    expect(repository.add('1', 'sold')).toBe(true)
    expect(repository.add('1', 'on_sale', 999)).toBe(true)
    expect(repository.list()).toEqual([{ productId: '1', favoritedAt: 555, statusSnapshot: 'sold' }])
    expect(storage.getItem('favorite:1')).toBe('true')
    expect(repository.remove('1')).toBe(true)
    expect(repository.remove('1')).toBe(true)
    expect(storage.getItem('favorite:1')).toBe('false')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('写入失败不改变已持久化列表且不通知', () => {
    const previous = JSON.stringify([{ productId: '1', favoritedAt: 10, statusSnapshot: 'on_sale' }])
    const storage = storageFixture({ [FAVORITES_STORAGE_KEY]: previous })
    const repository = createFavoriteRepository({ storage })
    const listener = vi.fn(); repository.subscribe(listener)
    storage.fail = true
    expect(repository.add('2')).toBe(false)
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe(previous)
    expect(listener).not.toHaveBeenCalled()
  })

  it('批量删除与 restore 保持本地事务', () => {
    const storage = storageFixture({ [FAVORITES_STORAGE_KEY]: JSON.stringify([{ productId: '1', favoritedAt: 1 }, { productId: '2', favoritedAt: 2 }]) })
    const repository = createFavoriteRepository({ storage })
    expect(repository.removeMany(['1', '2'])).toBe(true)
    expect(repository.list()).toEqual([])
    expect(repository.restore([{ productId: '3', favoritedAt: 3, statusSnapshot: 'off_shelf' }])).toBe(true)
    expect(repository.isFavorite('3')).toBe(true)
  })
})
