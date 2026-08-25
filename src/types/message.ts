export type MessageCategory = 'all' | 'groups' | 'notifications'
export type ConversationKind = 'trade_group' | 'support' | 'notification'
export type ConversationStage = 'need_action' | 'in_progress' | 'closed'
export type TradeState = 'binding' | 'confirmed' | 'mismatch' | 'closed'
export type MessageSender = 'buyer' | 'seller' | 'support' | 'system'
export type MessageDelivery = 'sending' | 'sent' | 'failed'

export type Conversation = {
  id: string
  kind: ConversationKind
  stage: ConversationStage
  tradeState?: TradeState
  gameCode?: string
  title: string
  avatarText: string
  orderId?: string
  productCode?: string
  orderAmount?: number
  progressLabel?: string
  elapsedLabel?: string
  lastMessage: string
  updatedAt: number
  unreadCount: number
  closed?: boolean
}

export type ConversationMessage = {
  id: string
  conversationId: string
  sender: MessageSender
  senderName: string
  content: string
  createdAt: number
  kind: 'text' | 'system' | 'image'
  delivery: MessageDelivery
  imageUrl?: string
}

export type MessageStore = { conversations: Conversation[]; messages: ConversationMessage[] }
export type MessageSummary = { unreadCount: number; groupCount: number; taskCount: number }
