import type { OrderRecord, OrderRole } from '../types/order'
import type { RecycleOrder } from '../types/recycle'

export type TradeOrderTab = 'all' | 'pending' | 'binding' | 'trading' | 'bind_success' | 'completed' | 'ended'
export type RecycleOrderTab = 'all' | 'pending' | 'processing' | 'completed' | 'ended'

export const BUYER_ORDER_TABS: ReadonlyArray<{ value: TradeOrderTab; label: string }> = [
  { value: 'all', label: '全部' }, { value: 'pending', label: '待付款' }, { value: 'trading', label: '交易中' },
  { value: 'bind_success', label: '待确认' }, { value: 'completed', label: '已完成' }, { value: 'ended', label: '已取消' },
]

export const SELLER_ORDER_TABS: ReadonlyArray<{ value: TradeOrderTab; label: string }> = [
  { value: 'all', label: '全部' }, { value: 'binding', label: '待换绑' }, { value: 'trading', label: '交易中' },
  { value: 'bind_success', label: '待确认' }, { value: 'completed', label: '已完成' }, { value: 'ended', label: '已关闭' },
]

export const RECYCLE_ORDER_TABS: ReadonlyArray<{ value: RecycleOrderTab; label: string }> = [
  { value: 'all', label: '全部' }, { value: 'pending', label: '待处理' }, { value: 'processing', label: '处理中' },
  { value: 'completed', label: '已完成' }, { value: 'ended', label: '已结束' },
]

export function isTradeOrderTab(role: OrderRole, value: string | null): value is TradeOrderTab {
  return (role === 'buyer' ? BUYER_ORDER_TABS : SELLER_ORDER_TABS).some((item) => item.value === value)
}

export function isRecycleOrderTab(value: string | null): value is RecycleOrderTab {
  return RECYCLE_ORDER_TABS.some((item) => item.value === value)
}

export function matchesTradeOrderTab(order: OrderRecord, role: OrderRole, tab: TradeOrderTab) {
  if (order.role !== role) return false
  if (tab === 'all') return true
  if (tab === 'trading') return role === 'buyer'
    ? ['paid', 'verifying', 'binding'].includes(order.status)
    : ['paid', 'verifying'].includes(order.status)
  if (tab === 'ended') return ['pay_expired', 'cancelled', 'closed'].includes(order.status)
  return order.status === tab
}

export function filterTradeOrders(orders: readonly OrderRecord[], role: OrderRole, tab: TradeOrderTab, query = '') {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  return orders.filter((order) => {
    if (!matchesTradeOrderTab(order, role, tab)) return false
    if (!normalized) return true
    return [order.id, order.productId, order.productTitle, order.gameName, order.server].some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized))
  }).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function countTradeOrders(orders: readonly OrderRecord[], role: OrderRole, tab: TradeOrderTab) {
  return orders.filter((order) => matchesTradeOrderTab(order, role, tab)).length
}

export function getActionableTradeOrders(orders: readonly OrderRecord[], role: OrderRole) {
  return orders.filter((order) => order.role === role && (role === 'buyer' ? ['pending', 'bind_success'].includes(order.status) : order.status === 'binding'))
}

export function matchesRecycleOrderTab(order: RecycleOrder, tab: RecycleOrderTab) {
  if (tab === 'all') return true
  if (tab === 'pending') return ['offered', 'materials', 'formal'].includes(order.stage) || (order.stage === 'submitted' && !order.submission)
  if (tab === 'processing') return order.stage === 'consulting' || order.stage === 'inspecting' || (order.stage === 'submitted' && Boolean(order.submission))
  if (tab === 'completed') return order.stage === 'completed'
  return order.stage === 'rejected'
}

export function filterRecycleOrders(orders: readonly RecycleOrder[], tab: RecycleOrderTab, query = '') {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  return orders.filter((order) => {
    if (!matchesRecycleOrderTab(order, tab)) return false
    if (!normalized) return true
    return [order.id, order.gameName, order.server, order.rank, order.recyclerName].some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized))
  }).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function countRecycleOrders(orders: readonly RecycleOrder[], tab: RecycleOrderTab) {
  return orders.filter((order) => matchesRecycleOrderTab(order, tab)).length
}

export function getActionableRecycleOrders(orders: readonly RecycleOrder[]) {
  return orders.filter((order) => matchesRecycleOrderTab(order, 'pending'))
}

export function getRecycleOrderStatusLabel(order: RecycleOrder) {
  return ({ consulting: '咨询中', offered: '待决定', materials: '待补资料', formal: '待确认', submitted: order.submission ? '待验号' : '待提交资料', inspecting: '验号中', completed: '已完成', rejected: '已结束' } as const)[order.stage]
}

export function formatEntryBadge(count: number) {
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
}
