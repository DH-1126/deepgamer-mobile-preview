export type FootprintStatus = 'selling' | 'trading' | 'sold' | 'off_shelf'
export type FootprintTimeFilter = 'all' | 'last3days' | 'days3to7' | 'before7days'

export type FootprintItem = {
  /** Product id used by the product-detail route. */
  id: string
  game: string
  gameName: string
  productCode: string
  title: string
  price: number
  status: FootprintStatus
  viewedAt: number
  image: string
}

export type FootprintFilters = {
  game: string
  status: 'all' | FootprintStatus
  time: FootprintTimeFilter
  query: string
}

export const defaultFootprintFilters: FootprintFilters = {
  game: 'all',
  status: 'all',
  time: 'all',
  query: '',
}

const isValidTimestamp = (value: number) => Number.isFinite(value) && !Number.isNaN(new Date(value).getTime())

const localTime = (base: number, hours: number, minutes: number) => {
  const date = new Date(base)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

const daysAgoAt = (now: number, days: number, hours: number, minutes: number) => {
  const date = new Date(now)
  date.setHours(hours, minutes, 0, 0)
  date.setDate(date.getDate() - days)
  return Math.min(date.getTime(), now)
}

/**
 * Local footprint fixtures. IDs, product codes, and images reuse products from
 * the catalog/detail fixtures; the first three prices remain the screen-design
 * examples rather than altering catalog product data.
 */
export function createFootprintItems(now = Date.now()): FootprintItem[] {
  const safeNow = isValidTimestamp(now) ? now : Date.now()

  return [
    {
      id: '1', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0001',
      title: '王者50★ 108英雄 312皮肤 倪克斯神谕', price: 1280, status: 'selling',
      viewedAt: Math.min(localTime(safeNow, 9, 36), safeNow), image: 'assets/footprint-v3/wzry.png',
    },
    {
      id: 'hpjy-1', game: 'hpjy', gameName: '和平精英', productCode: 'HPJY-hpjy-1',
      title: '和平精英 微信区 满级', price: 860, status: 'selling',
      viewedAt: Math.min(localTime(safeNow, 9, 12), safeNow), image: 'assets/footprint-v3/hpjy.png',
    },
    {
      id: '2', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0002',
      title: '王者12★ 121英雄 201皮肤', price: 1890, status: 'selling',
      viewedAt: daysAgoAt(safeNow, 1, 18, 20), image: 'assets/catalog-v2/product-featured-2.png',
    },
    {
      id: '3', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0003',
      title: '最强王者 130英雄 571皮肤', price: 4370, status: 'trading',
      viewedAt: daysAgoAt(safeNow, 3, 15, 48), image: 'assets/products/p05.jpg',
    },
    {
      id: '4', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0004',
      title: '至尊星耀 132英雄 547皮肤', price: 4025, status: 'trading',
      viewedAt: daysAgoAt(safeNow, 6, 11, 5), image: 'assets/products/p07.jpg',
    },
    {
      id: 'ys-2', game: 'ys', gameName: '原神', productCode: 'YS-ys-2',
      title: '原神 国服 满命角色 专武齐全', price: 2860, status: 'trading',
      viewedAt: daysAgoAt(safeNow, 8, 20, 16), image: 'assets/products/p08.jpg',
    },
    {
      id: '5', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0005',
      title: '永恒钻石 131英雄 408皮肤', price: 1840, status: 'sold',
      viewedAt: daysAgoAt(safeNow, 15, 14, 30), image: 'assets/products/p08.jpg',
    },
    {
      id: 'ys-1', game: 'ys', gameName: '原神', productCode: 'YS-ys-1',
      title: '原神 亚服 五星6', price: 1420, status: 'sold',
      viewedAt: daysAgoAt(safeNow, 23, 12, 0), image: 'assets/footprint-v3/genshin.png',
    },
    {
      id: '6', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0006',
      title: '至尊星耀 130英雄 485皮肤', price: 4600, status: 'sold',
      viewedAt: daysAgoAt(safeNow, 29, 10, 42), image: 'assets/products/p06.jpg',
    },
    {
      id: 'hpjy-2', game: 'hpjy', gameName: '和平精英', productCode: 'HPJY-hpjy-2',
      title: '和平精英 QQ区 无敌战神 稀有军需', price: 2480, status: 'off_shelf',
      viewedAt: daysAgoAt(safeNow, 31, 19, 8), image: 'assets/products/p06.jpg',
    },
    {
      id: '7', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0007',
      title: '最强王者 129英雄 565皮肤', price: 4600, status: 'off_shelf',
      viewedAt: daysAgoAt(safeNow, 45, 16, 25), image: 'assets/products/p02.jpg',
    },
    {
      id: '8', game: 'wzry', gameName: '王者荣耀', productCode: 'WZ0008',
      title: '最强王者 129英雄 278皮肤', price: 1035, status: 'off_shelf',
      viewedAt: daysAgoAt(safeNow, 75, 8, 55), image: 'assets/products/p10.jpg',
    },
  ]
}

const stableNewestFirst = (items: FootprintItem[]) => items
  .map((item, index) => ({ item, index }))
  .sort((a, b) => b.item.viewedAt - a.item.viewedAt || a.index - b.index)
  .map(({ item }) => item)

const startOfLocalDay = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date
}

const timeLowerBound = (now: number, days: number) => {
  const boundary = startOfLocalDay(now)
  boundary.setDate(boundary.getDate() - (days - 1))
  return boundary.getTime()
}

export function filterFootprintItems(items: FootprintItem[], filters: FootprintFilters, now = Date.now()): FootprintItem[] {
  const safeNow = isValidTimestamp(now) ? now : Date.now()
  const last3DaysStart = timeLowerBound(safeNow, 3)
  const last7DaysStart = timeLowerBound(safeNow, 7)
  const terms = filters.query.trim().toLocaleLowerCase('zh-CN').split(/\s+/u).filter(Boolean)

  return stableNewestFirst(items.filter((item) => {
    if (!isValidTimestamp(item.viewedAt) || item.viewedAt > safeNow) return false
    if (filters.game !== 'all' && item.game !== filters.game) return false
    if (filters.status !== 'all' && item.status !== filters.status) return false
    if (filters.time === 'last3days' && item.viewedAt < last3DaysStart) return false
    if (filters.time === 'days3to7' && (item.viewedAt < last7DaysStart || item.viewedAt >= last3DaysStart)) return false
    if (filters.time === 'before7days' && item.viewedAt >= last7DaysStart) return false

    const searchableText = [item.title, item.gameName, item.productCode, item.id]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
    return terms.every((term) => searchableText.includes(term))
  }))
}

const padDatePart = (value: number) => String(value).padStart(2, '0')

export function formatFootprintTime(timestamp: number): string {
  if (!isValidTimestamp(timestamp)) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}
