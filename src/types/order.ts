export type OrderRole = 'buyer' | 'seller'

export type OrderStatus =
  | 'pending'
  | 'pay_expired'
  | 'cancelled'
  | 'paid'
  | 'verifying'
  | 'binding'
  | 'bind_success'
  | 'completed'
  | 'closed'

export type OrderPaymentMethod = 'alipay' | 'wechat'
export type OrderFilterStatus = 'all' | 'trading' | 'ended' | OrderStatus

export type OrderRecord = {
  id: string
  role: OrderRole
  status: OrderStatus
  productId: string
  productTitle: string
  gameName: string
  gameCode: string
  server: string
  thumbnail: string
  goodsAmountCents: number
  serviceAmountCents: number
  insuranceAmountCents: number
  totalAmountCents: number
  createdAt: number
  updatedAt: number
  expiresAt?: number
  actionExpiresAt?: number
  paymentMethod?: OrderPaymentMethod
  conversationId?: string
}

export type OrderQuery = {
  role?: OrderRole
  status?: OrderFilterStatus
  query?: string
}

export type OrderTimelineItem = {
  key: string
  title: string
  detail?: string
  state: 'complete' | 'current' | 'upcoming' | 'error'
}
