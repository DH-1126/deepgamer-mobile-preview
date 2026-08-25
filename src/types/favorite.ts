export type FavoriteStatus = 'on_sale' | 'trading' | 'sold' | 'off_shelf'
export type FavoriteTimeFilter = 'all' | '7d' | '30d'

export type FavoriteRecord = {
  productId: string
  favoritedAt: number
  statusSnapshot?: FavoriteStatus
}

export type FavoriteFilters = {
  gameCode: string
  status: 'all' | FavoriteStatus
  time: FavoriteTimeFilter
}

export type FavoriteView = {
  productId: string
  favoritedAt: number
  status: FavoriteStatus
  gameCode: string
  gameName: string
  gameIcon: string
  title: string
  price: number
  image: string
  platform: string
  eliteLevel: string
  tags: string[]
  navigable: boolean
}
