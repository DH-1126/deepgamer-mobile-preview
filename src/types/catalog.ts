export type SortKey = 'default' | 'price_asc' | 'price_desc' | 'listed_at_desc'

export type PublicAttributeScalar = string | number | boolean | null | undefined
export type PublicAttributeValue = PublicAttributeScalar | PublicAttributeScalar[]

export type Product = {
  id: string
  /** Stable public goods number. Linked goods must not substitute the internal entity ID. */
  productCode?: string
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
  verified?: boolean
  wantCount?: number
  publishedLabel?: string
  inscriptionFull?: boolean
  displayTitle?: string
  presentationSource?: 'design_fixture'
  /** Public game-attribute projection. Enum arrays contain stable option IDs/fullKeys, never labels. */
  attributeValues?: Record<string, PublicAttributeValue>
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
  minHero: '',
  negotiable: '',
}
