import { describe, expect, it } from 'vitest'
import {
  createFootprintItems,
  defaultFootprintFilters,
  filterFootprintItems,
  formatFootprintTime,
  type FootprintItem,
} from './footprintModel'

const local = (year: number, month: number, date: number, hours = 0, minutes = 0) => new Date(year, month - 1, date, hours, minutes, 0, 0).getTime()

const item = (id: string, viewedAt: number, overrides: Partial<FootprintItem> = {}): FootprintItem => ({
  id,
  game: 'wzry',
  gameName: '王者荣耀',
  productCode: `WZ-${id}`,
  title: `测试商品 ${id}`,
  price: 100,
  status: 'selling',
  viewedAt,
  image: 'image.png',
  ...overrides,
})

describe('footprintModel', () => {
  it('创建12条现有商品样例，四种状态各3条并覆盖三款游戏', () => {
    const now = local(2026, 9, 11, 10)
    const result = createFootprintItems(now)
    const statusCounts = result.reduce<Record<string, number>>((counts, record) => {
      counts[record.status] = (counts[record.status] ?? 0) + 1
      return counts
    }, {})

    expect(result).toHaveLength(12)
    expect(new Set(result.map(({ id }) => id)).size).toBe(12)
    expect(statusCounts).toEqual({ selling: 3, trading: 3, sold: 3, off_shelf: 3 })
    expect(new Set(result.map(({ game }) => game))).toEqual(new Set(['wzry', 'hpjy', 'ys']))
    expect(result.every(({ viewedAt }) => Number.isFinite(viewedAt) && viewedAt <= now)).toBe(true)
    expect(result.map(({ id, productCode }) => [id, productCode])).toEqual([
      ['1', 'WZ0001'], ['hpjy-1', 'HPJY-hpjy-1'], ['2', 'WZ0002'], ['3', 'WZ0003'],
      ['4', 'WZ0004'], ['ys-2', 'YS-ys-2'], ['5', 'WZ0005'], ['ys-1', 'YS-ys-1'],
      ['6', 'WZ0006'], ['hpjy-2', 'HPJY-hpjy-2'], ['7', 'WZ0007'], ['8', 'WZ0008'],
    ])
    expect(result[0]).toMatchObject({ id: '1', price: 1280, status: 'selling' })
    expect(result[1]).toMatchObject({ id: 'hpjy-1', price: 860, status: 'selling' })
    expect(result.find(({ id }) => id === 'ys-1')).toMatchObject({ price: 1420, status: 'sold' })
    expect(result.some((record) => 'decrease' in record)).toBe(false)
  })

  it('时间样例覆盖最近3天、3到7天及7天以前', () => {
    const now = local(2026, 9, 11, 10)
    const records = createFootprintItems(now)

    expect(filterFootprintItems(records, { ...defaultFootprintFilters, time: 'last3days' }, now)).toHaveLength(3)
    expect(filterFootprintItems(records, { ...defaultFootprintFilters, time: 'days3to7' }, now)).toHaveLength(2)
    expect(filterFootprintItems(records, { ...defaultFootprintFilters, time: 'before7days' }, now)).toHaveLength(7)
    expect(filterFootprintItems(records, defaultFootprintFilters, now)).toHaveLength(12)
  })

  it('凌晨创建时今日样例不会位于未来，同时保留原始稳定顺序', () => {
    const now = local(2026, 9, 11, 7, 30)
    const result = createFootprintItems(now)
    expect(result[0].viewedAt).toBe(now)
    expect(result[1].viewedAt).toBe(now)
    expect(filterFootprintItems(result, defaultFootprintFilters, now).slice(0, 2).map(({ id }) => id)).toEqual(['1', 'hpjy-1'])
  })

  it('搜索忽略大小写和多余空白，多词与游戏状态为 AND 组合', () => {
    const now = local(2026, 9, 11, 12)
    expect(filterFootprintItems(createFootprintItems(now), {
      game: 'ys', status: 'sold', time: 'before7days', query: '  原神   YS-1  ',
    }, now).map(({ id }) => id)).toEqual(['ys-1'])

    expect(filterFootprintItems(createFootprintItems(now), {
      game: 'wzry', status: 'trading', time: 'days3to7', query: '  王者   wz0003 ',
    }, now).map(({ id }) => id)).toEqual(['3'])

    expect(filterFootprintItems(createFootprintItems(now), {
      game: 'hpjy', status: 'selling', time: 'last3days', query: 'HPJY   和平',
    }, now).map(({ id }) => id)).toEqual(['hpjy-1'])
  })

  it('三档按本地自然日在跨年午夜互斥分界，合并等于全部历史', () => {
    const now = local(2027, 1, 2, 0, 0)
    const records = [
      item('now', now),
      item('last3-start', local(2026, 12, 31, 0, 0)),
      item('middle-latest', local(2026, 12, 30, 23, 59)),
      item('middle-start', local(2026, 12, 27, 0, 0)),
      item('before7', local(2026, 12, 26, 23, 59)),
      item('future', now + 1),
      item('invalid', Number.NaN),
    ]

    const all = filterFootprintItems(records, defaultFootprintFilters, now).map(({ id }) => id)
    const last3 = filterFootprintItems(records, { ...defaultFootprintFilters, time: 'last3days' }, now).map(({ id }) => id)
    const middle = filterFootprintItems(records, { ...defaultFootprintFilters, time: 'days3to7' }, now).map(({ id }) => id)
    const before7 = filterFootprintItems(records, { ...defaultFootprintFilters, time: 'before7days' }, now).map(({ id }) => id)
    const combined = [...last3, ...middle, ...before7]

    expect(last3).toEqual(['now', 'last3-start'])
    expect(middle).toEqual(['middle-latest', 'middle-start'])
    expect(before7).toEqual(['before7'])
    expect(new Set(combined).size).toBe(combined.length)
    expect([...combined].sort()).toEqual([...all].sort())
  })

  it('按浏览时间稳定倒序且不修改原数组', () => {
    const records = [item('a', 2), item('b', 2), item('c', 3)]
    const snapshot = [...records]
    expect(filterFootprintItems(records, defaultFootprintFilters, 10).map(({ id }) => id)).toEqual(['c', 'a', 'b'])
    expect(records).toEqual(snapshot)
  })

  it('按本地时区格式化完整时间，跨年、月日及午夜均补零', () => {
    expect(formatFootprintTime(local(2026, 12, 31, 23, 59))).toBe('2026-12-31 23:59')
    expect(formatFootprintTime(local(2027, 1, 1, 0, 5))).toBe('2027-01-01 00:05')
    expect(formatFootprintTime(local(2027, 2, 3, 4, 6))).toBe('2027-02-03 04:06')
    expect(formatFootprintTime(Number.NaN)).toBe('')
  })
})
