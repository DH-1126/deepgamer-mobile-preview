import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOrderSeed } from '../data/orderFixtures'
import { afterSalesFixtures } from '../data/afterSalesFixtures'
import { createPendingOrderStore } from './pendingOrderStore'

function source<T>(items: T[]) {
  const listeners = new Set<() => void>()
  return {
    list: vi.fn(() => items),
    subscribe: vi.fn((listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }),
    replace(next: T[]) { items = next; listeners.forEach(listener => listener()) },
    listeners,
  }
}

describe('global pending order store', () => {
  afterEach(() => vi.useRealTimers())

  it('has a stable snapshot and propagates independent order and aftersales changes', () => {
    const now = 2_000_000_000_000
    const orders = source(createOrderSeed(now))
    const afterSales = source(afterSalesFixtures)
    const store = createPendingOrderStore({ orders, afterSales, now: () => now })
    const initial = store.getSnapshot()
    expect(store.getSnapshot()).toBe(initial)
    expect(initial.totalPendingCount).toBe(7)
    const listener = vi.fn(); const stop = store.subscribe(listener)
    orders.replace(orders.list().map(order => order.status === 'pending' ? { ...order, status: 'paid' } : order))
    expect(store.getSnapshot().totalPendingCount).toBe(5)
    expect(listener).toHaveBeenCalledTimes(1)
    afterSales.replace(afterSales.list().map(item => ({ ...item, status: 'completed' })))
    expect(store.getSnapshot().totalPendingCount).toBe(4)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    expect(orders.listeners.size + afterSales.listeners.size).toBe(0)
  })

  it('shares one clock across mounted consumers and removes expired-payment badges', () => {
    vi.useFakeTimers()
    const now = 2_000_000_000_000
    vi.setSystemTime(now)
    const orders = source(createOrderSeed(now).map(order => ({ ...order, expiresAt: now + 1000 })))
    const afterSales = source<typeof afterSalesFixtures[number]>([])
    const store = createPendingOrderStore({ orders, afterSales })
    expect(store.getSnapshot().totalPendingCount).toBe(6)
    const home = vi.fn(); const profile = vi.fn()
    const stopHome = store.subscribe(home); const stopProfile = store.subscribe(profile)
    expect(vi.getTimerCount()).toBe(1)
    expect(orders.subscribe).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(store.getSnapshot().totalPendingCount).toBe(4)
    expect(home).toHaveBeenCalledTimes(1); expect(profile).toHaveBeenCalledTimes(1)
    stopHome(); expect(vi.getTimerCount()).toBe(1)
    stopProfile(); expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the last known count if a source becomes unavailable', () => {
    const now = 2_000_000_000_000
    const orders = source(createOrderSeed(now))
    const afterSales = source(afterSalesFixtures)
    const store = createPendingOrderStore({ orders, afterSales, now: () => now })
    const snapshot = store.getSnapshot()
    orders.list.mockImplementation(() => { throw new Error('storage unavailable') })
    expect(store.getSnapshot()).toBe(snapshot)
  })
})
