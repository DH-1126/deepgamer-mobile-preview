import { describe, expect, it } from 'vitest'
import { createSellRepository, GAME_ACCESS_REQUESTS_KEY, type SellStorage } from './sellRepository'

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

  it('records trimmed game suggestions once without changing the current game selection', () => {
    const repository = createSellRepository({ storage: storage(), now: () => 100 })
    repository.selectGame('wzry')
    const selection = repository.getSelection()
    expect(repository.requestGame({ gameName: ' 示例游戏 ', manufacturer: ' 示例厂商 ' })).toBe(true)
    expect(repository.requestGame({ gameName: '示例游戏', manufacturer: '示例厂商' })).toBe(true)
    expect(repository.getGameRequests()).toEqual([{ gameName: '示例游戏', manufacturer: '示例厂商', createdAt: 100 }])
    expect(repository.getSelection()).toEqual(selection)
    expect(repository.requestGame({ gameName: '另一个游戏', manufacturer: '另一家厂商' })).toBe(true)
    expect(repository.getGameRequests()).toHaveLength(2)
  })

  it('rejects invalid submissions without writing a request', () => {
    const saved = storage()
    const repository = createSellRepository({ storage: saved })
    expect(repository.requestGame({ gameName: '', manufacturer: '厂商' })).toBe(false)
    expect(repository.requestGame({ gameName: '游戏', manufacturer: ' ' })).toBe(false)
    expect(saved.getItem(GAME_ACCESS_REQUESTS_KEY)).toBeNull()
  })

  it('reports storage failures and preserves existing suggestions for retry', () => {
    const saved = storage()
    const initial = JSON.stringify([{ gameName: '原有游戏', manufacturer: '原有厂商', createdAt: 10 }])
    saved.setItem(GAME_ACCESS_REQUESTS_KEY, initial)
    const failing = { ...saved, setItem: () => { throw new Error('Storage unavailable') } }
    const repository = createSellRepository({ storage: failing })
    expect(repository.requestGame({ gameName: '新增游戏', manufacturer: '新增厂商' })).toBe(false)
    expect(saved.getItem(GAME_ACCESS_REQUESTS_KEY)).toBe(initial)
    saved.setItem(GAME_ACCESS_REQUESTS_KEY, 'invalid-json')
    expect(createSellRepository({ storage: saved }).requestGame({ gameName: '新增游戏', manufacturer: '新增厂商' })).toBe(false)
    expect(saved.getItem(GAME_ACCESS_REQUESTS_KEY)).toBe('invalid-json')
  })
})
