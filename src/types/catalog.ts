export type SortKey = 'default' | 'price_asc' | 'price_desc' | 'listed_at_desc'

export type Product = {
  id: string
  gameCode: string
  title: string
  price: number
  image: string
  tags: string[]
  eliteLevel: string
  skinCount: number
  platform: string
  rank: string
  realName: string
  secondRealName: boolean
  faceCompensation: boolean
  listedAt: number
  heroCount?: number
  negotiable?: boolean
  wantCount?: number
  publishedLabel?: string
  inscriptionFull?: boolean
  displayTitle?: string
}

export type Game = {
  code: string
  name: string
  description: string
  image: string
  saleCount?: number
}

export type ProductFilters = {
  minPrice: string
  maxPrice: string
  minSkin: string
  maxSkin: string
  eliteLevels: string[]
  platforms: string[]
  ranks: string[]
  realNames: string[]
  secondRealName: string
  faceCompensation: string
  skins: string[]
  skinMatchRule: 'any' | 'all'
  minHero: string
  negotiable: string
}

export const emptyFilters: ProductFilters = {
  minPrice: '',
  maxPrice: '',
  minSkin: '',
  maxSkin: '',
  eliteLevels: [],
  platforms: [],
  ranks: [],
  realNames: [],
  secondRealName: '',
  faceCompensation: '',
  skins: [],
  skinMatchRule: 'all',
  minHero: '',
  negotiable: '',
}
