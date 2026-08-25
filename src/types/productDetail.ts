export type ProductDetailStatus = 'on_sale' | 'reserved' | 'sold'
export type PurchasePackage = 'STANDARD' | 'PREMIUM'

export type DetailMetric = { label: string; value: string }
export type AssetCategory = { name: string; count: number; items: string[] }

export type ProductDetail = {
  id: string
  aliases: string[]
  productCode: string
  gameCode: string
  gameName: string
  gameIcon: string
  title: string
  price: number
  originalPrice?: number
  status: ProductDetailStatus
  platform: string
  rank: string
  heroCount: number
  skinCount: number
  realName: string
  secondRealName: boolean
  negotiable: boolean
  verified: boolean
  wantCount?: number
  gallery: string[]
  metrics: DetailMetric[]
  summary: DetailMetric[]
  assetCategories: AssetCategory[]
  description: string[]
  groupName: string
  groupNumber: string
  guaranteeCovered: string[]
  guaranteeExcluded: string[]
  tips: string[]
}
