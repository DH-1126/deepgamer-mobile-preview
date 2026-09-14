import type { Conversation, ConversationMessage, MessageCategory, MessageStore } from '../types/message'

/** Conversation timestamps use local calendar days, not elapsed 24-hour windows. */
export function formatConversationTime(timestamp: number, now = Date.now()) {
  const messageDate = new Date(timestamp)
  const currentDate = new Date(now)
  if (!Number.isFinite(messageDate.getTime()) || !Number.isFinite(currentDate.getTime())) return '--'
  const sameDay = (other: Date) => messageDate.getFullYear() === other.getFullYear()
    && messageDate.getMonth() === other.getMonth() && messageDate.getDate() === other.getDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  if (sameDay(currentDate)) return `${pad(messageDate.getHours())}:${pad(messageDate.getMinutes())}`
  const yesterday = new Date(currentDate)
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(yesterday)) return '昨天'
  if (messageDate.getFullYear() !== currentDate.getFullYear()) return String(messageDate.getFullYear())
  return `${pad(messageDate.getMonth() + 1)}-${pad(messageDate.getDate())}`
}

export function filterConversations(conversations: Conversation[], category: MessageCategory, query = '') {
  const normalized = query.trim().toLowerCase()
  return conversations.filter((item) => {
    if (category === 'all' && item.stage === 'closed') return false
    if (category === 'groups' && item.kind !== 'trade_group') return false
    if (category === 'notifications' && item.kind !== 'notification') return false
    if (!normalized) return true
    return [item.title, item.orderId, item.productCode, item.lastMessage].some((value) => value?.toLowerCase().includes(normalized))
  }).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function groupTradeConversations(conversations: Conversation[]) {
  return {
    need_action: conversations.filter((item) => item.kind === 'trade_group' && item.stage === 'need_action'),
    in_progress: conversations.filter((item) => item.kind === 'trade_group' && item.stage === 'in_progress'),
    closed: conversations.filter((item) => item.kind === 'trade_group' && item.stage === 'closed'),
  }
}

export function getMessageSummary(store: MessageStore) {
  return {
    // Detailed notifications replace the legacy notification summary, never count both.
    unreadCount: store.conversations.reduce((sum, item) => sum + (store.notifications && item.kind === 'notification' ? 0 : item.unreadCount), 0)
      + (store.notifications?.filter(item => item.unread).length ?? 0),
    groupCount: store.conversations.filter((item) => item.kind === 'trade_group' && item.stage !== 'closed').length,
    taskCount: store.conversations.filter((item) => item.kind === 'trade_group' && item.stage === 'need_action').length,
  }
}

export function validateMessageText(text: string) {
  const content = text.trim()
  return !content ? '请输入消息' : content.length > 1000 ? '消息不能超过1000字' : ''
}

export function createPendingMessage(conversationId: string, content: string, now: number, id = `local-${now}`): ConversationMessage {
  return { id, conversationId, sender: 'buyer', senderName: '我', content: content.trim(), createdAt: now, kind: 'text', delivery: 'sending' }
}

export function markDelivery(message: ConversationMessage, delivery: 'sent' | 'failed') { return { ...message, delivery } }
export function canSendQuick(lastSentAt: number | null, now: number, cooldownMs = 10_000) { return lastSentAt === null || now - lastSentAt >= cooldownMs }
export function canAdvanceBinding(conversation: Conversation) { return conversation.kind === 'trade_group' && conversation.tradeState === 'binding' && !conversation.closed }
export function appendMessage(store: MessageStore, message: ConversationMessage): MessageStore {
  return { ...store, conversations: store.conversations.map((item) => item.id === message.conversationId ? { ...item, lastMessage: `${message.senderName}：${message.content}`, updatedAt: message.createdAt } : item), messages: [...store.messages, message] }
}
