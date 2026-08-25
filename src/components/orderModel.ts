import type { OrderFilterStatus, OrderQuery, OrderRecord, OrderRole, OrderStatus, OrderTimelineItem } from '../types/order'

export const ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'pay_expired', 'cancelled', 'paid', 'verifying', 'binding', 'bind_success', 'completed', 'closed']
export const ORDER_ROLES: readonly OrderRole[] = ['buyer', 'seller']

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['paid', 'pay_expired', 'cancelled'],
  pay_expired: [],
  cancelled: [],
  paid: ['verifying', 'closed'],
  verifying: ['binding', 'closed'],
  binding: ['bind_success', 'closed'],
  bind_success: ['completed', 'closed'],
  completed: [],
  closed: [],
}

const labels: Record<OrderStatus, string> = {
  pending: '待付款', pay_expired: '支付超时', cancelled: '已取消', paid: '已付款', verifying: '平台验号中',
  binding: '换绑中', bind_success: '待确认收货', completed: '已完成', closed: '已关闭',
}

export function isOrderStatus(value: string | null): value is OrderStatus {
  return value !== null && ORDER_STATUSES.includes(value as OrderStatus)
}

export function isOrderRole(value: string | null): value is OrderRole {
  return value !== null && ORDER_ROLES.includes(value as OrderRole)
}

export function isOrderFilterStatus(value: string | null): value is OrderFilterStatus {
  return value === 'all' || value === 'trading' || value === 'ended' || isOrderStatus(value)
}

export function getOrderStatusLabel(status: OrderStatus, role: OrderRole = 'buyer') {
  if (status === 'binding') return role === 'seller' ? '待你换绑' : '等卖家换绑'
  if (status === 'bind_success') return role === 'seller' ? '等买家确认' : '待确认收货'
  return labels[status]
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return from === to || transitions[from].includes(to)
}

export function transitionOrder(order: OrderRecord, status: OrderStatus, now: number): OrderRecord {
  if (order.status === status) return order
  if (!canTransitionOrder(order.status, status)) return order
  return { ...order, status, updatedAt: now }
}

export function expirePendingOrders(orders: readonly OrderRecord[], now: number) {
  let changed = false
  const next = orders.map((order) => {
    if (order.status !== 'pending' || order.expiresAt === undefined || order.expiresAt > now) return order
    changed = true
    return transitionOrder(order, 'pay_expired', now)
  })
  return changed ? next : orders
}

export function matchesOrderStatus(status: OrderStatus, filter: OrderFilterStatus) {
  if (filter === 'all') return true
  if (filter === 'trading') return ['paid', 'verifying', 'binding', 'bind_success'].includes(status)
  if (filter === 'ended') return ['pay_expired', 'cancelled', 'closed'].includes(status)
  return status === filter
}

export function filterOrders(orders: readonly OrderRecord[], query: OrderQuery = {}) {
  const normalized = query.query?.trim().toLocaleLowerCase('zh-CN') ?? ''
  return orders.filter((order) => {
    if (query.role && order.role !== query.role) return false
    if (query.status && !matchesOrderStatus(order.status, query.status)) return false
    if (!normalized) return true
    return [order.id, order.productTitle, order.gameName, order.server].some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized))
  }).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function countOrdersByStatus(orders: readonly OrderRecord[], role: OrderRole, status: OrderFilterStatus) {
  return orders.filter((order) => order.role === role && matchesOrderStatus(order.status, status)).length
}

export function formatOrderMoney(cents: number) {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0
  return `¥${(safe / 100).toLocaleString('zh-CN', { minimumFractionDigits: safe % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`
}

export function formatOrderCountdown(deadline: number | undefined, now: number) {
  if (!deadline) return '--:--'
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function getOrderTimeline(order: OrderRecord, now = Date.now()): OrderTimelineItem[] {
  const flow: OrderStatus[] = ['paid', 'verifying', 'binding', 'bind_success', 'completed']
  const currentIndex = flow.indexOf(order.status)
  const terminalError = ['closed', 'cancelled', 'pay_expired'].includes(order.status)
  const titles = order.role === 'seller'
    ? ['买家已付款 · 资金托管中', '平台验号', '卖家换绑', '买家确认', '平台结算 · 打款给你']
    : ['已付款 · 资金托管中', '平台验号', '等卖家换绑', '待你确认', '交易完成 · 放款给卖家']
  const items: OrderTimelineItem[] = [{ key: 'created', title: '已下单', state: 'complete', detail: new Date(order.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) }]
  if (order.status === 'pending') return [...items, { key: 'pending', title: '待付款', detail: `剩 ${formatOrderCountdown(order.expiresAt, now)}`, state: 'current' }]
  if (terminalError) return [...items, { key: order.status, title: getOrderStatusLabel(order.status, order.role), state: 'error' }]
  return [...items, ...flow.map((status, index) => ({
    key: status,
    title: titles[index],
    state: index < currentIndex || order.status === 'completed' ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
    ...(index === currentIndex && order.actionExpiresAt ? { detail: `剩 ${formatOrderCountdown(order.actionExpiresAt, now)}` } : {}),
  } as OrderTimelineItem))]
}

export function getOrderPrimaryMessage(order: OrderRecord) {
  const role = order.role
  const messages: Record<OrderStatus, { title: string; detail: string }> = {
    pending: { title: '待支付', detail: '超时未付将自动取消订单并释放该商品。' },
    pay_expired: { title: '支付已超时', detail: '订单已自动关闭，商品已重新开放给其他买家。' },
    cancelled: { title: '订单已取消', detail: '取消操作已完成，不会产生任何扣款。' },
    paid: { title: '付款成功', detail: '资金已进入平台托管，平台正在建立交易流程。' },
    verifying: { title: '平台验号中', detail: '平台正在核对账号资料，结果会同步到交易群。' },
    binding: role === 'seller' ? { title: '该你换绑', detail: '买家已付款，资金由平台托管，请按交易群步骤提供资料。' } : { title: '等卖家换绑', detail: '卖家已收到通知，超时可申请平台客服介入。' },
    bind_success: role === 'seller' ? { title: '等买家确认', detail: '换绑已完成，买家确认后平台将按规则结算。' } : { title: '待你确认收货', detail: '请核对账号资料；确认后平台将按规则结算给卖家。' },
    completed: { title: '交易完成', detail: '平台交易流程已完成。' },
    closed: { title: '交易已关闭', detail: '该订单已终止，资金按平台规则处理。' },
  }
  return messages[order.status]
}
