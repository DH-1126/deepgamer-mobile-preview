import { describe, expect, it } from 'vitest'
import { createOrderSeed } from '../data/orderFixtures'
import { afterSalesFixtures } from '../data/afterSalesFixtures'
import { getPendingOrderSummary } from './pendingOrderModel'

describe('shared pending order summary', () => {
  const now = 2_000_000_000_000
  it('sums the buyer, seller and actionable aftersales entry badges', () => {
    expect(getPendingOrderSummary(createOrderSeed(now), afterSalesFixtures, now)).toEqual({ buyerPendingCount: 4, sellerPendingCount: 2, afterSalePendingCount: 1, totalPendingCount: 7 })
  })

  it('excludes expired payments and paused trades without needing the profile page to mount', () => {
    const orders = createOrderSeed(now).map(order => order.status === 'binding' ? { ...order, pausedPhase: 'binding' as const } : order)
    expect(getPendingOrderSummary(orders, [], now + 31 * 60_000)).toEqual({ buyerPendingCount: 2, sellerPendingCount: 0, afterSalePendingCount: 0, totalPendingCount: 2 })
  })

  it('does not count duplicate records, finished orders or platform-side processing', () => {
    const orders = createOrderSeed(now)
    expect(getPendingOrderSummary([...orders, ...orders], [...afterSalesFixtures, ...afterSalesFixtures], now).totalPendingCount).toBe(7)
    expect(getPendingOrderSummary(orders.map(order => ({ ...order, status: 'completed' })), afterSalesFixtures.filter(item => item.status !== 'supplement'), now).totalPendingCount).toBe(0)
  })
})
