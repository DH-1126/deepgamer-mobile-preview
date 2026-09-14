import { EMPTY_PENDING_ORDER_SUMMARY, getPendingOrderSummary } from '../components/pendingOrderModel'
import type { OrderRecord } from '../types/order'
import type { AfterSaleRecord } from '../types/aftersale'
import { orderRepository } from './orderRepository'
import { afterSaleRepository } from './afterSaleRepository'

type ObservableList<T> = { list(): T[]; subscribe(listener: () => void): () => void }

export function createPendingOrderStore({ orders, afterSales, now = Date.now }: {
  orders: ObservableList<OrderRecord>
  afterSales: ObservableList<AfterSaleRecord>
  now?: () => number
}) {
  let lastOrders: OrderRecord[] = []
  let lastAfterSales: AfterSaleRecord[] = []
  let snapshot = EMPTY_PENDING_ORDER_SUMMARY
  const listeners = new Set<() => void>()
  let stop: (() => void) | undefined

  const getSnapshot = () => {
    try { lastOrders = orders.list() } catch { /* Keep the last usable snapshot on read failure. */ }
    try { lastAfterSales = afterSales.list() } catch { /* Do not silently clear existing badges. */ }
    const next = getPendingOrderSummary(lastOrders, lastAfterSales, now())
    if (next.buyerPendingCount !== snapshot.buyerPendingCount || next.sellerPendingCount !== snapshot.sellerPendingCount || next.afterSalePendingCount !== snapshot.afterSalePendingCount) snapshot = next
    return snapshot
  }
  const refresh = () => {
    const previous = snapshot
    if (getSnapshot() !== previous) listeners.forEach(listener => listener())
  }

  return {
    getSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (listeners.size === 1) {
        const stopOrders = orders.subscribe(refresh)
        const stopAfterSales = afterSales.subscribe(refresh)
        // One shared clock, so expired payments disappear even while staying on the homepage.
        const timer = setInterval(refresh, 1000)
        stop = () => { stopOrders(); stopAfterSales(); clearInterval(timer) }
      }
      return () => {
        listeners.delete(listener)
        if (!listeners.size) { stop?.(); stop = undefined }
      }
    },
  }
}

export const pendingOrderStore = createPendingOrderStore({ orders: orderRepository, afterSales: afterSaleRepository })
