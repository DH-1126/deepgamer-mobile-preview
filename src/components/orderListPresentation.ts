import type { OrderRecord, OrderStatus } from '../types/order'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'

export type OrderListTone = 'active' | 'complete' | 'closed'

export type OrderListAction = {
  label: string
  to: string
  variant: 'primary' | 'outline'
}

export type OrderListPresentation = {
  statusLabel: string
  tone: OrderListTone
  amountCents: number
  description: string
  countdown?: string
  tags: readonly string[]
  actions: readonly OrderListAction[]
  isRecycle: boolean
}

const activeStatuses: readonly OrderStatus[] = ['pending', 'paid', 'verifying', 'binding', 'bind_success']
const closedStatuses: readonly OrderStatus[] = ['closed', 'pay_expired', 'cancelled']

export function formatOrderListMoney(cents: number) {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0
  return `¥${(safe / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function countdown(deadline: number | undefined, now: number) {
  if (!deadline || !Number.isFinite(deadline)) return undefined
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function afterSaleDeadline(deadline: number | undefined) {
  if (!deadline || !Number.isFinite(deadline)) return ''
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function statusLabel(status: OrderStatus) {
  return ({ pending: '待付款', paid: '待资料同步', verifying: '验号中', binding: '换绑中', bind_success: '待放款', completed: '已完成', closed: '已关闭', pay_expired: '已过期', cancelled: '已关闭' } as const)[status]
}

function description(order: OrderRecord, recycle: boolean) {
  if (recycle) return '验收后你接受了新报价，款项已到账。'
  if (order.status === 'pending') return '超时未付将自动取消订单并释放该商品'
  if (order.status === 'paid') return '货款已托管，卖家正在同步账号资料。'
  if (order.status === 'verifying') return '卖家资料已同步，请在交易群核对账号'
  if (order.status === 'binding') return '超 24 小时未换绑可申请客服介入。'
  if (order.status === 'bind_success') return '换绑已完成，72 小时后系统自动放款。'
  if (order.status === 'completed') {
    const end = afterSaleDeadline(order.afterSaleEndsAt)
    return end ? `账号已交付，售后有效期至 ${end}。` : '账号已交付，平台交易流程已完成。'
  }
  if (order.status === 'closed') {
    const refunded = order.refundAmountCents
    return typeof refunded === 'number' && Number.isFinite(refunded) ? `卖家未按时换绑，${formatOrderListMoney(refunded)} 已原路退回` : '订单已关闭，如有疑问请联系平台客服。'
  }
  if (order.status === 'pay_expired') return '超时未支付，该账号已重新上架。'
  return order.cancelReason ? `你取消了订单 · ${order.cancelReason}` : '你取消了订单'
}

/** Maps an order record to static list-card copy and real routes; it does not mutate order state. */
export function getOrderListPresentation(order: OrderRecord, now: number): OrderListPresentation {
  const isRecycle = order.orderKind === 'recycle' && order.role === 'seller' && order.status === 'completed'
  const details = `/orders/${encodeURIComponent(order.id)}`
  const support = SUPPORT_CONVERSATION_ROUTE
  const group = order.conversationId
    ? `/im/${encodeURIComponent(order.conversationId)}?orderId=${encodeURIComponent(order.id)}&role=${encodeURIComponent(order.role)}`
    : details
  const actions: readonly OrderListAction[] = isRecycle
    ? [{ label: '联系客服', to: support, variant: 'outline' }, { label: '查看打款明细', to: details, variant: 'primary' }]
    : order.status === 'pending'
      ? [{ label: '取消订单', to: `/payment/cancel?id=${encodeURIComponent(order.id)}`, variant: 'outline' }, { label: '去支付', to: `/orders/checkout?id=${encodeURIComponent(order.id)}`, variant: 'primary' }]
      : activeStatuses.includes(order.status)
        ? [{ label: '联系客服', to: support, variant: 'outline' }, { label: '进交易群', to: group, variant: 'primary' }]
        : order.status === 'completed'
          ? [{ label: '申请售后', to: `/aftersales/apply?orderId=${encodeURIComponent(order.id)}`, variant: 'outline' }, { label: '联系客服', to: support, variant: 'outline' }]
          : [{ label: '联系客服', to: support, variant: 'outline' }]
  const tone: OrderListTone = activeStatuses.includes(order.status) ? 'active' : closedStatuses.includes(order.status) ? 'closed' : 'complete'
  return {
    statusLabel: isRecycle ? '已打款' : statusLabel(order.status),
    tone,
    amountCents: isRecycle ? order.goodsAmountCents : order.totalAmountCents,
    description: description(order, isRecycle),
    countdown: order.status === 'pending' ? countdown(order.expiresAt, now) : undefined,
    tags: order.listTags ?? [order.gameName, order.server].filter(Boolean),
    actions,
    isRecycle,
  }
}
