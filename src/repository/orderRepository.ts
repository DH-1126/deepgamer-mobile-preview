import { expirePendingOrders, filterOrders, getOrderWorkflowPhase, isOrderRole, isOrderStatus, transitionOrder } from '../components/orderModel'
import { createOrderSeed, ORDERS_STORAGE_KEY } from '../data/orderFixtures'
import { ARCHIVED_TRADE_ID, createArchivedTradeSeed } from '../data/archivedTradeFixtures'
import type { OrderPaymentMethod, OrderQuery, OrderRecord, OrderStatus, OrderWorkflowPhase } from '../types/order'
import { getRuntimeStorage, isLinkedDataMode } from '../runtime/dataMode'

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

const LEGACY_CONVERSATION_MIGRATIONS: Record<string, { from: string; to: string }> = {
  OD20260821000000003: { from: 'trade-wzry', to: 'trade-wzry-od03' },
  OD20260820000000005: { from: 'trade-wzry', to: 'trade-wzry-od05' },
}

function migrateLegacyConversations(orders: OrderRecord[], at: number) {
  let changed = false
  const next = orders.map((order) => {
    const migration = LEGACY_CONVERSATION_MIGRATIONS[order.id]
    if (!migration || order.conversationId !== migration.from) return order
    changed = true
    return { ...order, conversationId: migration.to }
  })
  if (!next.some(order => order.conversationId === ARCHIVED_TRADE_ID)
    && next.some(order => order.id === 'OD20260821000000001')) {
    const archivedOrder = createArchivedTradeSeed(at).order
    if (!next.some(order => order.id === archivedOrder.id)) { next.push(archivedOrder); changed = true }
  }
  return changed ? next : orders
}

export function createOrderRepository({ storage, now = Date.now, eventTarget }: OrderRepositoryOptions) {
  const listeners = new Set<() => void>()
  const source = `orders-${Math.random().toString(36).slice(2)}`

  const read = () => {
    const persisted = parseOrders(storage.getItem(ORDERS_STORAGE_KEY))
    if (persisted !== null) {
      const migrated = migrateLegacyConversations(persisted, now())
      if (migrated !== persisted) storage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }
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
    ensure(record: OrderRecord) {
      try {
        if (!isOrderRecord(record) || !record.conversationId) return false
        const orders = read()
        const existing = orders.find((order) => order.id === record.id)
        if (existing) {
          return existing.role === record.role
            && existing.productId === record.productId
            && existing.conversationId === record.conversationId
        }
        if (orders.some((order) => order.conversationId === record.conversationId)) return false
        return commit([...cloneOrders(orders), { ...record }])
      } catch { return false }
    },
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
        if (order.pausedPhase && order.status !== status) return null
        const next = transitionOrder(order, status, now())
        return next === order && order.status !== status ? null : next
      })
    },
    confirmReceipt(id: string) {
      return mutateOne(id, (order) => !order.pausedPhase && order.status === 'bind_success' ? transitionOrder(order, 'completed', now()) : null)
    },
    pause(id: string, phase: Exclude<OrderWorkflowPhase, 'completed' | 'closed'>) {
      return mutateOne(id, (order) => {
        if (order.pausedPhase === phase) return order
        if (order.pausedPhase || getOrderWorkflowPhase(order.status) !== phase) return null
        return { ...order, pausedPhase: phase, updatedAt: now() }
      })
    },
    restore(orders: readonly OrderRecord[]) {
      try {
        const conversationIds = orders.flatMap(order => order.conversationId ? [order.conversationId] : [])
        if (new Set(conversationIds).size !== conversationIds.length) return false
        return commit(cloneOrders(orders))
      } catch { return false }
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() { eventTarget?.removeEventListener(EVENT, external); eventTarget?.removeEventListener('storage', external); listeners.clear() },
  }
}

function memoryStorage(): OrderStorage {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

let storage: OrderStorage = getRuntimeStorage()
let eventTarget: OrderRepositoryOptions['eventTarget']
if (typeof window !== 'undefined' && !isLinkedDataMode) eventTarget = window
export const orderRepository = createOrderRepository({ storage, eventTarget })
