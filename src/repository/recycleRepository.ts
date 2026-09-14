import { canAdvanceStage } from '../components/sellModel'
import { validateRecycleOrderDraft } from '../components/recycleModel'
import { getRecycleUnreadCount } from '../components/recycleConversationModel'
import { createRecycleConsultationSeed, createRecycleOrder, LEGACY_RECYCLE_STORAGE_KEY, RECYCLE_STORAGE_KEY } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import type { RecycleFormInput, RecycleMaterialKey, RecycleOrder, RecycleOrderDraft, RecycleStage, RecycleStore } from '../types/recycle'
import { getRuntimeStorage } from '../runtime/dataMode'

export type RecycleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type RecycleRepositoryOptions = { storage: RecycleStorage; now?: () => number; seed?: RecycleStore }
const EVENT = 'deepgamer:recycle-change'

function cloneOrder(order: RecycleOrder): RecycleOrder { return { ...order, materials: order.materials.map((item) => ({ ...item })), messages: order.messages.map((item) => ({ ...item })), submission: order.submission ? { ...order.submission } : undefined } }
function cloneStore(store: RecycleStore): RecycleStore { return { activeOrderId: store.activeOrderId, orders: store.orders.map(cloneOrder) } }
function parseStore(raw: string | null, seed: RecycleStore): RecycleStore {
  if (!raw) return cloneStore(seed)
  try { const value = JSON.parse(raw) as RecycleStore; return Array.isArray(value?.orders) ? value : cloneStore(seed) } catch { return cloneStore(seed) }
}

export function createRecycleRepository({ storage, now = Date.now, seed = { activeOrderId: null, orders: [] } }: RecycleRepositoryOptions) {
  const listeners = new Set<() => void>()
  const read = () => parseStore(storage.getItem(RECYCLE_STORAGE_KEY) ?? storage.getItem(LEGACY_RECYCLE_STORAGE_KEY), seed)
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
    // Keep the complete-history preview first in its own list; All messages re-sorts by time.
    list() { return read().orders.map(cloneOrder).sort((a, b) => Number(Boolean(b.historyPreview)) - Number(Boolean(a.historyPreview)) || b.updatedAt - a.updatedAt) },
    getUnreadCount() { return read().orders.reduce((total, order) => total + getRecycleUnreadCount(order), 0) },
    get(id: string) { const order = read().orders.find((item) => item.id === id); return order ? cloneOrder(order) : undefined },
    getActive() { const store = read(); const order = store.orders.find((item) => item.id === store.activeOrderId); return order ? cloneOrder(order) : undefined },
    begin(recyclerId = 'fun', gameCode: Parameters<typeof createRecycleOrder>[2] = 'wzry') {
      const store = read(); const recycler = recyclerFixtures.find((item) => item.id === recyclerId && item.availability === 'online')
      if (!recycler) return undefined
      const existing = store.orders.find((item) => item.stage === 'consulting' && item.recyclerId === recyclerId && item.gameCode === gameCode)
      if (existing) { commit({ ...store, activeOrderId: existing.id }); return cloneOrder(existing) }
      const order = createRecycleOrder(recycler, now(), gameCode); return commit({ activeOrderId: order.id, orders: [order, ...store.orders] }) ? cloneOrder(order) : undefined
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
    createFormalOrder(id: string, draft?: RecycleOrderDraft) {
      const order = read().orders.find((item) => item.id === id)
      if (draft) {
        if (!order || order.stage !== 'consulting' || Object.keys(validateRecycleOrderDraft(draft)).length) return false
        return update(id, (item) => ({ ...item, quoteCents: draft.quoteCents, protectionFeeCents: Math.round(draft.quoteCents * 0.1), server: draft.server.trim(), rank: draft.rank.trim(), stage: 'formal', expiresAt: now() + 30 * 60_000, updatedAt: now(), messages: [...item.messages, { id: `formal-${now()}`, sender: 'recycler', content: `已根据“${draft.accountSummary.trim()}”发送正式回收单。`, createdAt: now() }] }))
      }
      if (!order || order.materials.some((item) => !item.completed)) return false
      return move(id, 'materials', 'formal')
    },
    confirmOrder(id: string) {
      const order = read().orders.find((item) => item.id === id)
      if (!order || order.stage !== 'formal') return false
      return update(id, (item) => ({ ...item, stage: 'submitted', sellerConfirmedAt: now(), updatedAt: now() }))
    },
    completePayment(id: string) {
      const order = read().orders.find((item) => item.id === id)
      if (!order || order.stage !== 'submitted') return undefined
      const paidAt = now()
      const next = { ...order, stage: 'completed' as const, conversationId: order.conversationId ?? `trade-recycle-${order.id}`, orderId: order.orderId ?? `OD-${order.id}`, paidAt, updatedAt: paidAt }
      return update(id, () => next) ? cloneOrder(next) : undefined
    },
    submit(id: string, input: RecycleFormInput) {
      const current = read().orders.find((order) => order.id === id)
      if (!current || current.stage !== 'submitted') return false
      return update(id, (order) => ({ ...order, updatedAt: now(), submission: { maskedLoginAccount: input.loginAccount.trim() ? '已填写' : '', campId: input.campId.trim() ? '已填写' : '', canRealname: Boolean(input.canRealname), screenshotCount: input.screenshotCount, note: input.note.trim() ? '已填写' : '', acceptedRules: input.acceptedRules } }))
    },
    startInspection(id: string) { return move(id, 'inspect', 'inspecting') },
    complete(id: string) { return move(id, 'complete', 'completed') },
    reject(id: string) { const order = read().orders.find((item) => item.id === id); if (!order || !canAdvanceStage(order.stage, 'reject')) return false; return update(id, (item) => ({ ...item, stage: 'rejected', updatedAt: now() })) },
    retry(id: string) { const order = read().orders.find((item) => item.id === id); if (!order || !['submitted', 'inspecting'].includes(order.stage)) return false; return update(id, (item) => ({ ...item, stage: 'submitted', updatedAt: now() })) },
    markRead(id: string) {
      const order = read().orders.find((item) => item.id === id)
      if (!order) return false
      if (getRecycleUnreadCount(order) === 0) return true
      return update(id, (item) => ({ ...item, unreadCount: 0 }))
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    clear() { try { storage.removeItem(RECYCLE_STORAGE_KEY); listeners.forEach((listener) => listener()); return true } catch { return false } },
  }
}

function memoryStorage(): RecycleStorage {
  const data = new Map<string, string>()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}
const storage: RecycleStorage = getRuntimeStorage()
export const recycleRepository = createRecycleRepository({ storage, seed: createRecycleConsultationSeed(Date.now(), recyclerFixtures) })
