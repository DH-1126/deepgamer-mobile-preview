import type { RecycleOrder } from '../types/recycle'

export type RecycleConversationStatus = '沟通中' | '已下单'

export function getRecycleConversationName(order: RecycleOrder) {
  return order.contactName?.trim() || order.recyclerName
}

export function getRecycleConversationStatus(order: RecycleOrder): RecycleConversationStatus {
  return ['formal', 'submitted', 'inspecting', 'completed'].includes(order.stage) ? '已下单' : '沟通中'
}

export function getRecycleUnreadCount(order: Pick<RecycleOrder, 'unreadCount'>) {
  const count = order.unreadCount
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return 0
  return Math.min(Math.floor(count), Number.MAX_SAFE_INTEGER)
}
