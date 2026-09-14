import { appendMessage, createPendingMessage, getMessageSummary, markDelivery } from '../components/messageModel'
import { createMessageSeed, MESSAGES_STORAGE_KEY } from '../data/messageFixtures'
import { createNotificationSeed } from '../data/notificationFixtures'
import { ARCHIVED_TRADE_ID, createArchivedTradeSeed } from '../data/archivedTradeFixtures'
import type { Conversation, ConversationMessage, MessageStore } from '../types/message'
import { getTradePhaseTitle, type TradePhase, type TradeRole } from '../components/tradeFlowModel'
import { getRuntimeStorage, isLinkedDataMode } from '../runtime/dataMode'

export type MessageStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Options = { storage: MessageStorage; now?: () => number; eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> }
export type WorkflowSummaryInput = {
  conversationId: string
  orderId: string
  phase: TradePhase
  role: TradeRole
  pausedPhase?: TradePhase
}
const EVENT = 'deepgamer:messages-change'

function parseStore(raw: string | null): MessageStore | null {
  if (raw === null) return null
  try {
    const value = JSON.parse(raw) as MessageStore
    return Array.isArray(value?.conversations) && Array.isArray(value?.messages) ? value : { conversations: [], messages: [] }
  } catch { return { conversations: [], messages: [] } }
}

const BUILT_IN_CONVERSATION_IDS = ['trade-wzry', 'trade-wzry-od03', 'trade-wzry-od05', 'trade-delta', 'trade-hpjy', 'trade-ys-closed']
function migrateLegacySeed(store: MessageStore, at: number): MessageStore {
  const hasLegacySeed = store.conversations.some(item => item.id === 'trade-wzry')
  const needsMigration = hasLegacySeed && (
    !store.conversations.some(item => item.id === 'trade-wzry-od03')
    || store.conversations.find(item => item.id === 'trade-hpjy')?.orderId === 'OD20260821000000003'
    || store.conversations.find(item => item.id === 'trade-delta')?.orderId === 'OD20260820000000002'
  )
  if (!needsMigration) return store
  const seed = createMessageSeed(at)
  const seededById = new Map(seed.conversations.map(item => [item.id, item]))
  const currentById = new Map(store.conversations.map(item => [item.id, item]))
  const conversations = store.conversations.map(item => {
    if (!BUILT_IN_CONVERSATION_IDS.includes(item.id)) return item
    const seeded = seededById.get(item.id)
    return seeded ? { ...item, ...seeded, unreadCount: item.unreadCount } : item
  })
  for (const id of ['trade-wzry-od03', 'trade-wzry-od05']) {
    const seeded = seededById.get(id)
    if (seeded && !currentById.has(id)) conversations.push(seeded)
  }
  const messages = store.messages.map(message => ['m1', 'm2', 'm3', 'm4'].includes(message.id)
    ? { ...message, conversationId: 'trade-wzry-od03' }
    : message)
  return { ...store, conversations, messages }
}

function migrateNotifications(store: MessageStore): MessageStore {
  if (Array.isArray(store.notifications)) return store
  const legacy = store.conversations.find(item => item.id === 'system-notice')
  let remaining = legacy?.unreadCount ?? 0
  return { ...store, notifications: legacy ? createNotificationSeed().map(item => {
    const unread = Boolean(item.unread) && remaining > 0
    if (unread) remaining -= 1
    return { ...item, unread }
  }) : [] }
}

function addMissingArchivedTrade(store: MessageStore, at: number): MessageStore {
  if (store.conversations.some(item => item.id === ARCHIVED_TRADE_ID)
    || !store.conversations.some(item => item.id === 'trade-wzry' && item.orderId === 'OD20260821000000001')) return store
  const archived = createArchivedTradeSeed(at)
  const existingMessageIds = new Set(store.messages.map(item => item.id))
  return { ...store, conversations: [...store.conversations, archived.conversation],
    messages: [...store.messages, ...archived.messages.filter(item => !existingMessageIds.has(item.id))] }
}

export const EMPTY_MESSAGE_STORE: MessageStore = { conversations: [], messages: [], notifications: [] }

export function createMessageRepository({ storage, now = Date.now, eventTarget }: Options) {
  const listeners = new Set<() => void>()
  const source = Math.random().toString(36).slice(2)
  let cachedRaw: string | null | undefined
  let cachedStore: MessageStore | undefined
  const read = () => {
    const raw = storage.getItem(MESSAGES_STORAGE_KEY)
    if (cachedStore && cachedRaw === raw) return cachedStore
    const current = parseStore(raw)
    if (current) {
      const migrated = addMissingArchivedTrade(migrateNotifications(migrateLegacySeed(current, now())), now())
      if (migrated !== current) storage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(migrated))
      cachedRaw = migrated === current ? raw : JSON.stringify(migrated)
      cachedStore = migrated
      return migrated
    }
    const seed = createMessageSeed(now())
    storage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(seed))
    cachedRaw = JSON.stringify(seed)
    cachedStore = seed
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
    /** Stable synchronous snapshot: navigation can subscribe before the message page mounts. */
    getSnapshot() { try { return read() } catch { return cachedStore ?? EMPTY_MESSAGE_STORE } },
    async list() { return read().conversations.map((item) => ({ ...item })) },
    async get(id: string) { const item = read().conversations.find((conversation) => conversation.id === id); return item ? { ...item } : undefined },
    async summary() { return getMessageSummary(read()) },
    async ensureConversation(conversation: Conversation) {
      try {
        const store = read()
        const existing = store.conversations.find(item => item.id === conversation.id)
        if (existing) return existing.kind === conversation.kind && existing.orderId === conversation.orderId
        if (conversation.orderId && store.conversations.some(item => item.orderId === conversation.orderId)) return false
        const next = conversation.orderId
          ? { ...conversation, workflowOrderId: conversation.orderId }
          : conversation
        return commit({ ...store, conversations: [...store.conversations, next] })
      } catch { return false }
    },
    async syncWorkflow({ conversationId, orderId, phase, role, pausedPhase }: WorkflowSummaryInput) {
      try {
        const store = read()
        const current = store.conversations.find(item => item.id === conversationId)
        if (!current || current.closed || current.orderId !== orderId || (current.workflowOrderId && current.workflowOrderId !== orderId)) return false
        const title = getTradePhaseTitle(phase, role)
        return commit({ ...store, conversations: store.conversations.map(item => item.id === conversationId ? {
          ...item,
          workflowOrderId: orderId,
          workflowPhase: phase,
          pausedPhase: phase === 'paused' ? pausedPhase : undefined,
          stage: phase === 'completed' || phase === 'closed' ? 'closed' : 'in_progress',
          closed: phase === 'closed' ? true : item.closed,
          progressLabel: title,
          updatedAt: now(),
          lastMessage: `平台：${title}`,
        } : item) })
      } catch { return false }
    },
    async markRead(id: string) {
      try { const store = read(); return commit({ ...store, conversations: store.conversations.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item) }) } catch { return false }
    },
    async markNotificationRead(id: string) {
      try {
        const store = read()
        if (!store.notifications?.some(item => item.id === id)) return false
        return commit({ ...store, notifications: store.notifications.map(item => item.id === id ? { ...item, unread: false } : item) })
      } catch { return false }
    },
    async markAllRead(scope: 'all' | 'notifications' = 'all') {
      try { const store = read(); return commit({ ...store, conversations: store.conversations.map((item) => scope === 'all' || item.kind === 'notification' ? { ...item, unreadCount: 0 } : item), notifications: store.notifications?.map(item => ({ ...item, unread: false })) }) } catch { return false }
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
let storage: MessageStorage = getRuntimeStorage(); let eventTarget: Options['eventTarget']
if (typeof window !== 'undefined' && !isLinkedDataMode) eventTarget = window
export const messageRepository = createMessageRepository({ storage, eventTarget })
