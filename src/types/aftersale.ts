export type AfterSaleStatus = 'pending_review' | 'supplement' | 'refunding' | 'platform_processing' | 'rejected' | 'completed'

export type AfterSaleRecord = {
  id: string
  orderId: string
  productId: string
  productTitle: string
  gameName: string
  server: string
  thumbnail: string
  status: AfterSaleStatus
  reason: string
  description: string
  statusMessage: string
  refundAmountCents: number
  createdAt: string
  updatedAt: string
}
