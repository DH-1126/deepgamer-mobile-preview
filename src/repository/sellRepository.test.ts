import { describe, expect, it } from 'vitest'
import { createSellRepository, type SellStorage } from './sellRepository'

function storage(): SellStorage { const data = new Map<string, string>(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } } }

describe('sellRepository', () => {
  it('选择新游戏会清空旧回收商', () => {
    const repository = createSellRepository({ storage: storage(), now: () => 100 })
    expect(repository.selectGame('wzry')).toBe(true)
    expect(repository.selectRecycler('fun')).toBe(true)
    expect(repository.getSelection()).toMatchObject({ gameCode: 'wzry', recyclerId: 'fun' })
    repository.selectGame('genshin')
    expect(repository.getSelection()).toMatchObject({ gameCode: 'genshin', recyclerId: null })
  })
})

