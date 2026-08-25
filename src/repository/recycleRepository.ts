import { canAdvanceStage, maskLoginAccount } from '../components/sellModel'
import { createRecycleOrder, RECYCLE_STORAGE_KEY } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import type { RecycleFormInput, RecycleMaterialKey, RecycleOrder, RecycleStage, RecycleStore } from '../types/recycle'

export type RecycleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type RecycleRepositoryOptions = { storage: RecycleStorage; now?: () => number }
const EVENT = 'deepgamer:recycle-change'

function cloneOrder(order: RecycleOrder): RecycleOrder { return { ...order, materials: order.materials.map((item) => ({ ...item })), messages: order.messages.map((item) => ({ ...item })), submission: order.submission ? { ...order.submission } : undefined } }
function parseStore(raw: string | null): RecycleStore {
  if (!raw) return { activeOrderId: null, orders: [] }
  try { const value = JSON.parse(raw) as RecycleStore; return Array.isArray(value?.orders) ? value : { activeOrderId: null, orders: [] } } catch { return { activeOrderId: null, orders: [] } }
}

export function createRecycleRepository({ storage, now = Date.now }: RecycleRepositoryOptions) {
  const listeners = new Set<() => void>()
  const read = () => parseStore(storage.getItem(RECYCLE_STORAGE_KEY))
  const commit = (store: RecycleStore) => {
    const previous = storage.getItem(RECYCLE_STORAGE_KEY)
    try { storage.setItem(RECYCLE_STORAGE_KEY, JSON.stringify(store)); listeners.forEach((listener) => listener()); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT)); return true }
    catch { try { previous === null ? storage.removeItem(RECYCLE_STORAGE_KEY) : storage.setItem(RECYCLE_STORAGE_KEY, previous) } catch { /* best effort */ } return false }
  }
  const update = (id: string, updater: (order: RecycleOrder) => RecycleOrder) => {
    const store = read(); let found = false
    const orders = store.orders.map((order) => { if (order.id !== id) return order; found = true; return updater(cloneOrder(order)) })
    return found && commit({ ...store, orders })
  }
  const move = (id: string, action: Parameters<typeof canAdvanceStage>[1], stage: RecycleStage) => {
    const current = read().orders.find((order) => order.id === id)
    if (!current || !canAdvanceStage(current.stage, action)) return false
    return update(id, (order) => ({ ...order, stage, updatedAt: now() }))
  }
  return {
    list() { return read().orders.map(cloneOrder).sort((a, b) => b.updatedAt - a.updatedAt) },
    getActive() { const store = read(); const order = store.orders.find((item) => item.id === store.activeOrderId); return order ? cloneOrder(order) : undefined },
    begin(recyclerId = 'fun') {
      const store = read(); const recycler = recyclerFixtures.find((item) => item.id === recyclerId && item.availability === 'online')
      if (!recycler) return undefined
      const existing = store.orders.find((item) => item.stage !== 'completed' && item.stage !== 'rejected')
      if (existing) { commit({ ...store, activeOrderId: existing.id }); return cloneOrder(existing) }
      const order = createRecycleOrder(recycler, now()); return commit({ activeOrderId: order.id, orders: [order, ...store.orders] }) ? cloneOrder(order) : undefined
    },
    sendMessage(id: string, content: string) {
      const current = read().orders.find((order) => order.id === id)
      if (!current || current.stage === 'completed' || current.stage === 'rejected' || !content.trim()) return false
      return update(id, (order) => ({ ...order, updatedAt: now(), messages: [...order.messages, { id: `local-${now()}`, sender: 'user', content: content.trim(), createdAt: now() }] }))
    },
    receiveOffer(id: string) { return move(id, 'offer', 'offered') },
    acceptOffer(id: string) { return move(id, 'accept', 'materials') },
    setMaterial(id: string, key: RecycleMaterialKey, value: string) {
      const current = read().orders.find((order) => order.id === id)
      if (!current || current.stage !== 'materials' || !current.materials.some((item) => item.key === key)) return false
      return update(id, (order) => ({ ...order, updatedAt: now(), materials: order.materials.map((item) => item.key === key ? { ...item, completed: Boolean(value), value } : item) }))
    },
    createFormalOrder(id: string) {
      const order = read().orders.find((item) => item.id === id)
      if (!order || order.materials.some((item) => !item.completed)) return false
      return move(id, 'materials', 'formal')
    },
    confirmOrder(id: string) { return move(id, 'confirm', 'submitted') },
    submit(id: string, input: RecycleFormInput) {
      const current = read().orders.find((order) => order.id === id)
      if (!current || current.stage !== 'submitted') return false
      return update(id, (order) => ({ ...order, updatedAt: now(), submission: { maskedLoginAccount: maskLoginAccount(input.loginAccount), campId: input.campId.trim(), canRealname: Boolean(input.canRealname), screenshotCount: input.screenshotCount, note: input.note.trim(), acceptedRules: input.acceptedRules } }))
    },
    startInspection(id: string) { return move(id, 'inspect', 'inspecting') },
    complete(id: string) { return move(id, 'complete', 'completed') },
    reject(id: string) { const order = read().orders.find((item) => item.id === id); if (!order || !canAdvanceStage(order.stage, 'reject')) return false; return update(id, (item) => ({ ...item, stage: 'rejected', updatedAt: now() })) },
    retry(id: string) { const order = read().orders.find((item) => item.id === id); if (!order || !['submitted', 'inspecting'].includes(order.stage)) return false; return update(id, (item) => ({ ...item, stage: 'submitted', updatedAt: now() })) },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    clear() { try { storage.removeItem(RECYCLE_STORAGE_KEY); listeners.forEach((listener) => listener()); return true } catch { return false } },
  }
}

function memoryStorage(): RecycleStorage {
  const data = new Map<string, string>()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}
let storage: RecycleStorage = memoryStorage()
if (typeof window !== 'undefined') { try { storage = window.localStorage } catch { /* storage unavailable */ } }
export const recycleRepository = createRecycleRepository({ storage })
