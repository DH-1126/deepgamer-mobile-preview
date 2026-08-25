import { expirePendingOrders, filterOrders, isOrderRole, isOrderStatus, transitionOrder } from '../components/orderModel'
import { createOrderSeed, ORDERS_STORAGE_KEY } from '../data/orderFixtures'
import type { OrderPaymentMethod, OrderQuery, OrderRecord, OrderStatus } from '../types/order'

export type OrderStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type OrderRepositoryOptions = {
  storage: OrderStorage
  now?: () => number
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>
}

const EVENT = 'deepgamer:orders-change'

function isOrderRecord(value: unknown): value is OrderRecord {
  if (!value || typeof value !== 'object') return false
  const order = value as OrderRecord
  return typeof order.id === 'string' && isOrderRole(order.role) && isOrderStatus(order.status)
    && Number.isInteger(order.goodsAmountCents) && Number.isInteger(order.totalAmountCents)
    && Number.isFinite(order.createdAt) && Number.isFinite(order.updatedAt)
}

function parseOrders(raw: string | null): OrderRecord[] | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter(isOrderRecord) : []
  } catch { return [] }
}

function cloneOrders(orders: readonly OrderRecord[]) {
  return orders.map((order) => ({ ...order }))
}

export function createOrderRepository({ storage, now = Date.now, eventTarget }: OrderRepositoryOptions) {
  const listeners = new Set<() => void>()
  const source = `orders-${Math.random().toString(36).slice(2)}`

  const read = () => {
    const persisted = parseOrders(storage.getItem(ORDERS_STORAGE_KEY))
    if (persisted !== null) return persisted
    const seed = createOrderSeed(now())
    storage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
  const emit = () => {
    listeners.forEach((listener) => listener())
    if (eventTarget && typeof CustomEvent !== 'undefined') eventTarget.dispatchEvent(new CustomEvent(EVENT, { detail: { source } }))
  }
  const commit = (next: readonly OrderRecord[]) => {
    const previous = storage.getItem(ORDERS_STORAGE_KEY)
    try {
      storage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(next))
      emit()
      return true
    } catch {
      try { previous === null ? storage.removeItem(ORDERS_STORAGE_KEY) : storage.setItem(ORDERS_STORAGE_KEY, previous) } catch { /* best effort rollback */ }
      return false
    }
  }
  const external = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.source === source) return
    if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent && event.key && event.key !== ORDERS_STORAGE_KEY) return
    listeners.forEach((listener) => listener())
  }
  eventTarget?.addEventListener(EVENT, external)
  eventTarget?.addEventListener('storage', external)

  const mutateOne = (id: string, mutate: (order: OrderRecord) => OrderRecord | null) => {
    try {
      const orders = read()
      const index = orders.findIndex((order) => order.id === id)
      if (index < 0) return false
      const nextOrder = mutate(orders[index])
      if (nextOrder === null) return false
      if (nextOrder === orders[index]) return true
      const next = cloneOrders(orders)
      next[index] = nextOrder
      return commit(next)
    } catch { return false }
  }

  return {
    list(query: OrderQuery = {}) { return cloneOrders(filterOrders(read(), query)) },
    get(id: string) { const found = read().find((order) => order.id === id); return found ? { ...found } : undefined },
    expire(at = now()) {
      try {
        const current = read()
        const next = expirePendingOrders(current, at)
        if (next === current) return 0
        const count = next.filter((order, index) => order.status === 'pay_expired' && current[index]?.status === 'pending').length
        return commit(next) ? count : 0
      } catch { return 0 }
    },
    cancel(id: string) {
      return mutateOne(id, (order) => {
        if (order.status === 'cancelled') return order
        if (order.status !== 'pending') return null
        return transitionOrder(order, 'cancelled', now())
      })
    },
    pay(id: string, paymentMethod: OrderPaymentMethod) {
      try {
        const orders = read()
        const index = orders.findIndex((order) => order.id === id)
        if (index < 0) return false
        const order = orders[index]
        const at = now()
        if (order.status === 'paid' && order.paymentMethod === paymentMethod) return true
        if (order.status !== 'pending') return false
        const next = cloneOrders(orders)
        if (order.expiresAt !== undefined && order.expiresAt <= at) {
          next[index] = transitionOrder(order, 'pay_expired', at)
          commit(next)
          return false
        }
        next[index] = { ...transitionOrder(order, 'paid', at), paymentMethod }
        return commit(next)
      } catch { return false }
    },
    advance(id: string, status: OrderStatus) {
      return mutateOne(id, (order) => {
        const next = transitionOrder(order, status, now())
        return next === order && order.status !== status ? null : next
      })
    },
    restore(orders: readonly OrderRecord[]) { try { return commit(cloneOrders(orders)) } catch { return false } },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() { eventTarget?.removeEventListener(EVENT, external); eventTarget?.removeEventListener('storage', external); listeners.clear() },
  }
}

function memoryStorage(): OrderStorage {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

let storage: OrderStorage = memoryStorage()
let eventTarget: OrderRepositoryOptions['eventTarget']
if (typeof window !== 'undefined') { try { storage = window.localStorage; eventTarget = window } catch { /* storage unavailable */ } }
export const orderRepository = createOrderRepository({ storage, eventTarget })
