import { appendMessage, createPendingMessage, getMessageSummary, markDelivery } from '../components/messageModel'
import { createMessageSeed, MESSAGES_STORAGE_KEY } from '../data/messageFixtures'
import type { ConversationMessage, MessageStore } from '../types/message'

export type MessageStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Options = { storage: MessageStorage; now?: () => number; eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> }
const EVENT = 'deepgamer:messages-change'

function parseStore(raw: string | null): MessageStore | null {
  if (raw === null) return null
  try {
    const value = JSON.parse(raw) as MessageStore
    return Array.isArray(value?.conversations) && Array.isArray(value?.messages) ? value : { conversations: [], messages: [] }
  } catch { return { conversations: [], messages: [] } }
}

export function createMessageRepository({ storage, now = Date.now, eventTarget }: Options) {
  const listeners = new Set<() => void>()
  const source = Math.random().toString(36).slice(2)
  const read = () => {
    const current = parseStore(storage.getItem(MESSAGES_STORAGE_KEY))
    if (current) return current
    const seed = createMessageSeed(now())
    storage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
  const emit = () => {
    listeners.forEach((listener) => listener())
    if (eventTarget && typeof CustomEvent !== 'undefined') eventTarget.dispatchEvent(new CustomEvent(EVENT, { detail: { source } }))
  }
  const commit = (next: MessageStore) => {
    const previous = storage.getItem(MESSAGES_STORAGE_KEY)
    try { storage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(next)); emit(); return true }
    catch {
      try { previous === null ? storage.removeItem(MESSAGES_STORAGE_KEY) : storage.setItem(MESSAGES_STORAGE_KEY, previous) } catch { /* best effort */ }
      return false
    }
  }
  const external = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.source === source) return
    if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent && event.key && event.key !== MESSAGES_STORAGE_KEY) return
    listeners.forEach((listener) => listener())
  }
  eventTarget?.addEventListener(EVENT, external)
  eventTarget?.addEventListener('storage', external)

  return {
    async list() { return read().conversations.map((item) => ({ ...item })) },
    async get(id: string) { const item = read().conversations.find((conversation) => conversation.id === id); return item ? { ...item } : undefined },
    async summary() { return getMessageSummary(read()) },
    async markRead(id: string) {
      try { const store = read(); return commit({ ...store, conversations: store.conversations.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item) }) } catch { return false }
    },
    async markAllRead() {
      try { const store = read(); return commit({ ...store, conversations: store.conversations.map((item) => ({ ...item, unreadCount: 0 })) }) } catch { return false }
    },
    async listMessages(id: string) { return read().messages.filter((message) => message.conversationId === id).map((message) => ({ ...message })) },
    async sendText(conversationId: string, content: string, id?: string) {
      const pending = createPendingMessage(conversationId, content, now(), id)
      try {
        const store = read()
        if (!store.conversations.some((item) => item.id === conversationId && !item.closed)) return { ok: false, message: markDelivery(pending, 'failed') }
        const sent = markDelivery(pending, 'sent')
        return commit(appendMessage(store, sent)) ? { ok: true, message: sent } : { ok: false, message: markDelivery(pending, 'failed') }
      } catch { return { ok: false, message: markDelivery(pending, 'failed') } }
    },
    async advanceBinding(conversationId: string) {
      try {
        const store = read(); const conversation = store.conversations.find((item) => item.id === conversationId)
        if (!conversation || conversation.tradeState !== 'binding' || conversation.closed) return false
        const message: ConversationMessage = { id: `system-confirm-${conversationId}`, conversationId, sender: 'system', senderName: '平台', content: '买家已确认换绑，交易进入确认收货阶段', createdAt: now(), kind: 'system', delivery: 'sent' }
        const next = appendMessage({ ...store, conversations: store.conversations.map((item) => item.id === conversationId ? { ...item, tradeState: 'confirmed', progressLabel: '步骤 4 / 5 · 待确认收货' } : item) }, message)
        return commit(next)
      } catch { return false }
    },
    async reportMismatch(conversationId: string) {
      try {
        const store = read(); const conversation = store.conversations.find((item) => item.id === conversationId)
        if (!conversation || conversation.tradeState !== 'binding' || conversation.closed) return false
        const message: ConversationMessage = { id: `system-mismatch-${conversationId}`, conversationId, sender: 'system', senderName: '平台', content: '买家反馈验号不符，已暂停交易并通知平台客服介入', createdAt: now(), kind: 'system', delivery: 'sent' }
        return commit(appendMessage({ ...store, conversations: store.conversations.map((item) => item.id === conversationId ? { ...item, tradeState: 'mismatch', progressLabel: '验号不符 · 客服介入中' } : item) }, message))
      } catch { return false }
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() { eventTarget?.removeEventListener(EVENT, external); eventTarget?.removeEventListener('storage', external); listeners.clear() },
  }
}

function memoryStorage(): MessageStorage {
  const data = new Map<string, string>()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}
let storage: MessageStorage = memoryStorage(); let eventTarget: Options['eventTarget']
if (typeof window !== 'undefined') { try { storage = window.localStorage; eventTarget = window } catch { /* storage unavailable */ } }
export const messageRepository = createMessageRepository({ storage, eventTarget })
