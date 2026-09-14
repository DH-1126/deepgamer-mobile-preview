import type { PublicAttributeValue } from './catalog'
import type { LinkedPublishSnapshot } from '../../../双端演示/src/contract'

export type ProductDetailStatus = 'on_sale' | 'reserved' | 'sold' | 'off_shelf'
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
  displayTitle?: string
  presentationSource?: 'design_fixture'
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
  /** Account evidence images, separate from the catalog cover when provided. */
  evidenceImages?: string[]
  metrics: DetailMetric[]
  summary: DetailMetric[]
  assetCategories: AssetCategory[]
  description: string[]
  groupName: string
  groupNumber: string
  guaranteeCovered: string[]
  guaranteeExcluded: string[]
  tips: string[]
  tags?: string[]
  eliteLevel?: string
  inscriptionFull?: boolean
  /** Public game-attribute projection. Enum arrays contain stable option IDs/fullKeys, never labels. */
  attributeValues?: Record<string, PublicAttributeValue>
  /** Immutable labels and display values captured with a linked configured submission. */
  linkedPublishSnapshot?: LinkedPublishSnapshot
}
