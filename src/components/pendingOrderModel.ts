import type { AfterSaleRecord } from '../types/aftersale'
import type { OrderRecord } from '../types/order'
import { getActionableTradeOrders } from './orderHubModel'

export type PendingOrderSummary = {
  buyerPendingCount: number
  sellerPendingCount: number
  afterSalePendingCount: number
  totalPendingCount: number
}

export const EMPTY_PENDING_ORDER_SUMMARY: PendingOrderSummary = {
  buyerPendingCount: 0, sellerPendingCount: 0, afterSalePendingCount: 0, totalPendingCount: 0,
}

/** Count user actions, not all unfinished trades or platform-only processing. */
export function getPendingOrderSummary(orders: readonly OrderRecord[], afterSales: readonly AfterSaleRecord[], now = Date.now()): PendingOrderSummary {
  const available = orders.filter(order => !order.pausedPhase && !(order.status === 'pending' && order.expiresAt !== undefined && order.expiresAt <= now))
  const buyerPendingCount = new Set(getActionableTradeOrders(available, 'buyer').map(order => order.id)).size
  const sellerPendingCount = new Set(getActionableTradeOrders(available, 'seller').map(order => order.id)).size
  const afterSalePendingCount = new Set(afterSales.filter(item => item.status === 'supplement').map(item => item.id)).size
  return { buyerPendingCount, sellerPendingCount, afterSalePendingCount, totalPendingCount: buyerPendingCount + sellerPendingCount + afterSalePendingCount }
}
