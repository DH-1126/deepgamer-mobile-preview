export type OrderRole = 'buyer' | 'seller'

export type OrderStatus =
  | 'pending'
  | 'pay_expired'
  | 'cancelled'
  | 'paid'
  | 'verifying'
  | 'binding'
  | 'signed'
  | 'insuring'
  | 'insured'
  | 'bind_success'
  | 'completed'
  | 'closed'

export type OrderPaymentMethod = 'alipay' | 'wechat'
export type OrderFilterStatus = 'all' | 'trading' | 'ended' | OrderStatus
export type OrderWorkflowPhase = 'materials' | 'inspection' | 'binding' | 'signed' | 'insuring' | 'insured' | 'release' | 'completed' | 'closed'

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
  paymentReference?: string
  paidAt?: number
  conversationId?: string
  /** 订单列表展示元数据；兼容历史订单。 */
  orderKind?: 'account' | 'recycle'
  listTags?: string[]
  afterSaleEndsAt?: number
  refundAmountCents?: number
  cancelReason?: string
  /** 异常介入时保留被暂停的履约阶段；存在时任何正常推进都必须被拦截。 */
  pausedPhase?: Exclude<OrderWorkflowPhase, 'completed' | 'closed'>
  /** 可选展示字段，旧订单记录不提供时仍使用 productTitle。 */
  titleValues?: Record<string, string | number | boolean | null | undefined | Array<string | number | boolean | null | undefined>>
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
