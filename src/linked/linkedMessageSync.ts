import type { Conversation, ConversationMessage, ConversationStage } from '../types/message'
import { messageRepository } from '../repository/messageRepository'

/**
 * HTTP 联动的消息同步：把后台 im_conversations / im_messages 映射进内存消息仓库，
 * 消息列表与交易群聊天读后台数据；发送等写操作仍为本地演示（下一批接入端点）。
 */

export type AdminConversationRow = {
  id: string
  conversationNo?: string
  type?: string
  title: string
  status?: string
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  updatedAt?: string
  participantNames?: string[]
  unreadCount?: number
}

export type AdminMessageRow = {
  id: string
  sequence?: number
  messageType?: string
  senderType?: string
  senderName?: string | null
  content: string
  createdAt?: string
}

const STAGE_BY_STATUS: Record<string, ConversationStage> = {
  ACTIVE: 'in_progress',
  CLOSED: 'closed',
}

/** 后台会话类型 → 原型会话类型（AI 咨询/私聊归入客服，回收咨询保持独立列表行）。 */
function toConversationKind(type: string | undefined): Conversation['kind'] {
  if (type === 'TRADE_GROUP') return 'trade_group'
  if (type === 'RECYCLE_CONSULTATION') return 'trade_group' // 回收咨询行复用交易群 kind，由标题与列表徽章区分展示
  return 'support'
}

function toConversation(row: AdminConversationRow, messages: readonly AdminMessageRow[]): Conversation {
  const updatedAt = row.updatedAt ?? row.lastMessageAt
  const lastMessage = row.lastMessagePreview ?? messages.at(-1)?.content ?? ''
  return {
    id: row.id,
    kind: toConversationKind(row.type),
    stage: STAGE_BY_STATUS[row.status ?? 'ACTIVE'] ?? 'in_progress',
    title: row.title,
    avatarText: (row.title || '会').slice(0, 1),
    lastMessage,
    updatedAt: updatedAt ? Date.parse(updatedAt) || Date.now() : Date.now(),
    unreadCount: row.unreadCount ?? 0,
    messages: messages.map(toMessage),
  } as Conversation
}

function toMessage(row: AdminMessageRow): ConversationMessage {
  const sender = row.senderType === 'SYSTEM' ? 'system' : row.senderType === 'SERVICE' ? 'support' : row.senderType === 'BUYER' ? 'buyer' : 'seller'
  return {
    id: row.id,
    sender,
    senderName: row.senderName ?? (sender === 'system' ? '系统' : '成员'),
    content: row.content,
    createdAt: row.createdAt ? Date.parse(row.createdAt) || Date.now() : Date.now(),
  } as ConversationMessage
}

/** 拉取每个会话的消息并整体灌入消息仓库（内存态；替换全部本地演示会话）。 */
export async function seedLinkedConversations(fetchJson: (path: string) => Promise<unknown>): Promise<Conversation[]> {
  const payload = await fetchJson('/im/conversations?page=1&pageSize=50') as { data?: AdminConversationRow[] } | AdminConversationRow[]
  const rows = Array.isArray(payload) ? payload : payload?.data ?? []
  const conversations: Conversation[] = []
  for (const row of rows) {
    let messages: AdminMessageRow[] = []
    try {
      const messagePayload = await fetchJson(`/im/conversations/${encodeURIComponent(row.id)}/messages?limit=30`) as { data?: AdminMessageRow[] } | AdminMessageRow[]
      messages = (Array.isArray(messagePayload) ? messagePayload : messagePayload?.data ?? []).slice()
    } catch { /* 单会话消息失败时保留空记录 */ }
    conversations.push(toConversation(row, messages))
  }
  messageRepository.replaceAll(conversations)
  return conversations
}
